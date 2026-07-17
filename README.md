# Tom_Riddle_Diary
A web-based, AI-powered notebook interface inspired by Tom Riddle's diary. Write natural language questions directly on the parchment, and watch the answers bleed through the page.

Instead of traditional chat boxes or manual file uploads, this project offers a seamless, zero-UI experience. You simply draw or write on the screen—jot down a natural language question —and the interface handles the rest. Your ink slowly fades into the parchment, and a local Vision LLM reads your handwriting to bleed the answer back onto the page in a cursive, organic script.

## 🛠️ Tech Stack

* **Frontend:** Vanilla HTML5, CSS3, and JavaScript (Canvas API)
* **Backend/AI:** [Ollama](https://ollama.com/) running a local Vision LLM (I'm using gemma4:e4b at the time of developing this.)
* **Fonts:** Google Fonts ('Caveat' for the realistic handwriting and 'Cormorant Garamond' for the atmospheric UI)

## 🚀 Getting Started

### Prerequisites
1. Install [Ollama](https://ollama.com/).
2. Pull a vision-capable model to process the handwriting. Run the following in your terminal:
   ```bash
   ollama run <your_preferred_LLM_name>
3. Make sure to change the model parameter in the dairy.js file with the LLM name that you're using.

## P.S.

We are not storing scribbles/prompts anywhere, it'll be sent to the LLM locally and discarded after the transaction ends.
