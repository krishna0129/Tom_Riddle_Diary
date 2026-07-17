(function(){
  const canvas = document.getElementById('liveCanvas');
  const ctx = canvas.getContext('2d');
  const overlayContainer = document.getElementById('overlayContainer');

  const DEBOUNCE_MS = 2500;       // Pause before the diary reads the ink
  const INK_FADE_DELAY = 1000;    // How long before your handwriting starts fading
  const REPLY_LINGER_TIME = 6000; // How long the response stays on screen after finishing
  const FADE_DURATION = 2600;     // Matches the CSS transition length

  let debounceTimer = null;
  let hasInk = false;
  let drawing = false;
  let lastPoint = null;
  let lastWidth = 3;
  let lastTime = 0;
  let busy = false;
  let exchanges = []; 

  // Tracking where the user draws so we can place the reply underneath it
  let bounds = { minX: Infinity, minY: Infinity, maxX: 0, maxY: 0 };

  function sizeCanvas(){
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#201409';
  }
  window.addEventListener('resize', sizeCanvas);
  sizeCanvas();

  function resetTimer(){
    clearTimeout(debounceTimer);
    if (busy) return;
    debounceTimer = setTimeout(processEntry, DEBOUNCE_MS);
  }

  function midpoint(a,b){ return { x:(a.x+b.x)/2, y:(a.y+b.y)/2 }; }

  function getPos(e){
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function widthFromSpeed(dist, dt){
    const speed = dist / Math.max(dt, 1);
    const w = 3.4 - speed * 6;
    return Math.max(1, Math.min(4.2, w));
  }

  function updateBounds(p) {
    if (p.x < bounds.minX) bounds.minX = p.x;
    if (p.x > bounds.maxX) bounds.maxX = p.x;
    if (p.y < bounds.minY) bounds.minY = p.y;
    if (p.y > bounds.maxY) bounds.maxY = p.y;
  }

  function startStroke(e){
    if (busy) return;
    drawing = true;
    
    if (!hasInk) {
        // Reset bounding box for a new passage
        bounds = { minX: Infinity, minY: Infinity, maxX: 0, maxY: 0 };
    }
    
    hasInk = true;
    const p = getPos(e);
    updateBounds(p);
    
    lastPoint = p;
    lastTime = performance.now();
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    resetTimer();
  }

  function moveStroke(e){
    if (!drawing || busy) return;
    const p = getPos(e);
    updateBounds(p);
    
    const now = performance.now();
    const dist = Math.hypot(p.x-lastPoint.x, p.y-lastPoint.y);
    const w = widthFromSpeed(dist, now-lastTime);
    lastWidth = lastWidth*0.7 + w*0.3;

    const mid = midpoint(lastPoint, p);
    ctx.lineWidth = lastWidth;
    ctx.beginPath();
    ctx.moveTo(lastPoint.x, lastPoint.y);
    ctx.quadraticCurveTo(lastPoint.x, lastPoint.y, mid.x, mid.y);
    ctx.stroke();

    lastPoint = p;
    lastTime = now;
    resetTimer();
  }

  function endStroke(){
    drawing = false;
    resetTimer();
  }

  canvas.addEventListener('pointerdown', startStroke);
  canvas.addEventListener('pointermove', moveStroke);
  window.addEventListener('pointerup', endStroke);
  canvas.addEventListener('pointerdown', (e)=>canvas.setPointerCapture(e.pointerId));

  function clearLive(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    hasInk = false;
  }

  // Helper to fade and remove elements from the DOM safely
  function fadeAndRemove(el, delay) {
      setTimeout(() => {
          el.classList.add('fade-out');
          setTimeout(() => el.remove(), FADE_DURATION);
      }, delay);
  }

  async function processEntry(){
    if (!hasInk || busy) return;
    busy = true;

    // 1. Capture the ink and clear the canvas instantly for new drawing
    const dataUrl = canvas.toDataURL('image/png');
    const base64 = dataUrl.split(',')[1];
    
    const inkSnapshot = document.createElement('img');
    inkSnapshot.src = dataUrl;
    inkSnapshot.className = 'ink-snapshot';
    overlayContainer.appendChild(inkSnapshot);
    
    clearLive();

    // 2. Schedule the user's ink to fade away
    fadeAndRemove(inkSnapshot, INK_FADE_DELAY);

    // 3. Setup the reply container dynamically below the handwriting
    // 3. Setup the reply container dynamically below the handwriting
    const replyDiv = document.createElement('div');
    replyDiv.className = 'reply';
    
    const startY = Math.min(bounds.maxY + 30, canvas.height - 100);
    replyDiv.style.top = `${startY}px`;

    // Removed the cursor tip logic completely. Just append the replyDiv.
    overlayContainer.appendChild(replyDiv);

    try {
      // Removed the tipEl parameter
      const fullText = await streamDiaryReply(base64, replyDiv);
      exchanges.push(fullText);
      if (exchanges.length > 4) exchanges.shift();
      
      // 4. Schedule the response to fade away after finishing
      fadeAndRemove(replyDiv, REPLY_LINGER_TIME);
      
    } catch(err) {
      tip.remove();
      const errSpan = document.createElement('span');
      errSpan.style.fontFamily = "'Cormorant Garamond', serif";
      errSpan.style.opacity = '0.6';
      errSpan.textContent = '(the ink scatters... something interrupted it)';
      replyDiv.appendChild(errSpan);
      fadeAndRemove(replyDiv, REPLY_LINGER_TIME);
      console.error(err);
    } finally {
      busy = false;
    }
  }

  const SYSTEM_PROMPT = `You are the presence inside an old, enchanted diary — written to as an atmospheric homage to Tom Riddle's diary from Harry Potter, for a personal creative project. Someone has just handwritten a note on the page, shown to you as an image; read their handwriting as best you can.

Voice: elegant, old-fashioned, quietly charming, a little knowing — as though something intelligent has been waiting inside the pages for a long time. Keep replies short: one to four sentences, in flowing first-person prose, no stage directions, no asterisks, no emoji.`;

  // Removed tipEl from the parameters
  async function streamDiaryReply(base64Image, replyDiv) {
    const messages = [
        { role: 'system', content: SYSTEM_PROMPT }
    ];

    for (const prevReply of exchanges) {
        messages.push({ role: 'user', content: '[another page was written on]' });
        messages.push({ role: 'assistant', content: prevReply });
    }

    messages.push({
        role: 'user',
        content: 'Here is what was just written on the page.',
        images: [base64Image]
    });

    const response = await fetch('http://localhost:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: 'gemma4:e4b', 
            messages,
            stream: true
        })
    });

    if (!response.ok || !response.body){
      throw new Error('request failed: ' + response.status);
    }

    const queue = [];
    let fullText = '';
    let revealing = false;

    function pump(){
      if (revealing) return;
      revealing = true;
      const tick = ()=>{
        if (queue.length === 0){ revealing = false; return; }
        
        // Grab the whole word/syllable chunk instead of a single letter
        const chunkText = queue.shift();
        
        const span = document.createElement('span');
        span.className = 'chunk';
        span.textContent = chunkText;
        replyDiv.appendChild(span);
        
        // Organic, uneven delay (70-130ms) to look like ink bleeding naturally
        setTimeout(tick, 70 + Math.random() * 60); 
      };
      tick();
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';

    while (true){
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      
      const lines = buf.split('\n');
      buf = lines.pop(); 

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const chunk = JSON.parse(line);
          if (chunk.message && chunk.message.content) {
            const text = chunk.message.content;
            fullText += text;
            
            // Push the entire text chunk to the queue
            queue.push(text);
            pump();
          }
        } catch (e) {
          console.error("Error parsing Ollama stream chunk:", e, line);
        }
      }
    }

    await new Promise(resolve=>{
      const check = ()=> queue.length === 0 && !revealing ? resolve() : setTimeout(check, 60);
      check();
    });
    
    return fullText || '(the page stays quiet)';
  }
})();