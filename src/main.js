
const root = document.querySelector('#app');
root.innerHTML = `
  <div class="shell">
    <aside class="sidebar">
      <div class="brand"><div class="brand-icon">✳</div><span>ai1<span class="brand-dot">.</span></span></div>
      <button class="new-chat" id="new-chat" type="button"><span>＋</span> New conversation</button>
      <div class="sidebar-label">YOUR WORKSPACE</div>
      <div class="active-conversation"><span>◌</span> Chat with Qwen <i>↗</i></div>
      <div class="sidebar-bottom"><div class="side-mark">✦</div><div><strong>A little room to think.</strong><p>Made for your next idea.</p></div></div>
    </aside>
    <main class="main">
      <header class="topbar"><div><span class="header-title">Your workspace</span><span class="header-divider">/</span><span class="header-current">Chat</span></div><div class="topbar-actions"><button id="mobile-new-chat" type="button" aria-label="New conversation">＋ New</button><div class="model-pill"><span class="model-dot"></span> Qwen 2.5 <span class="model-size">0.5B</span></div></div></header>
      <section class="chat-scroll" id="chat-scroll" aria-label="Conversation">
        <div class="conversation" id="conversation" aria-live="polite"></div>
        <div class="welcome" id="welcome"><div class="welcome-icon">✳</div><div class="eyebrow">YOUR SPACE TO THINK</div><h1>What's on your mind<span>?</span></h1><p>Have an idea, a question, or just want to talk?<br>I'm here to help you think it through.</p><div class="suggestions"><button type="button" data-prompt="Help me brainstorm a creative project."><span>✦</span> Brainstorm an idea <b>↗</b></button><button type="button" data-prompt="Explain something interesting to me in a simple way."><span>◈</span> Learn something new <b>↗</b></button><button type="button" data-prompt="Help me write a thoughtful message."><span>✎</span> Help me write <b>↗</b></button></div></div>
      </section>
      <div class="composer-area"><div class="status" id="status" role="status"></div><form id="chat-form" class="composer"><textarea id="prompt" rows="1" placeholder="Ask anything, or just say hello..." aria-label="Your message" maxlength="12000"></textarea><div class="composer-footer"><span>✳ <span>Qwen 2.5 · runs on your device</span></span><button id="send" type="submit" aria-label="Send message">↑</button></div></form><div class="disclaimer">Qwen can make mistakes. Check important information. <span>·</span> Chats stay in this tab.</div><div class="device-note">First use downloads several hundred MB. Phones may be slow or run out of memory.</div></div>
    </main>
  </div>`;

const form = document.querySelector('#chat-form');
const prompt = document.querySelector('#prompt');
const chat = document.querySelector('#conversation');
const welcome = document.querySelector('#welcome');
const status = document.querySelector('#status');
const send = document.querySelector('#send');
const reset = document.querySelector('#new-chat');
const mobileReset = document.querySelector('#mobile-new-chat');
const scroll = document.querySelector('#chat-scroll');
let messages = [];
let pending = false;
let worker;

function render() {
  chat.replaceChildren();
  welcome.hidden = messages.length > 0;
  for (const message of messages) {
    const row = document.createElement('article');
    row.className = `message ${message.role}`;
    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.textContent = message.role === 'user' ? 'Y' : '✳';
    const body = document.createElement('div');
    const name = document.createElement('div');
    name.className = 'message-name';
    name.textContent = message.role === 'user' ? 'You' : 'Qwen';
    const content = document.createElement('div');
    content.className = 'message-content';
    content.textContent = message.content;
    body.append(name, content);
    row.append(avatar, body);
    chat.append(row);
  }
  scroll.scrollTop = scroll.scrollHeight;
}
function setPending(value) {
  pending = value; send.disabled = value; reset.disabled = value; mobileReset.disabled = value; prompt.disabled = value;
  document.querySelectorAll('[data-prompt]').forEach(button => { button.disabled = value; });
}
function fail(message) {
  const failed = messages.pop();
  if (failed?.role === 'user') prompt.value = failed.content;
  status.textContent = message;
  status.classList.add('error');
  setPending(false); render(); prompt.focus();
}
function getWorker() {
  if (!worker) {
    worker = new Worker(new URL('./model-worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }) => {
      if (data.type === 'status') status.textContent = data.text;
      if (data.type === 'complete') {
        messages.push({ role: 'assistant', content: data.text });
        status.textContent = ''; setPending(false); render(); prompt.focus();
      }
      if (data.type === 'error') fail(data.text);
    };
    worker.onerror = () => { worker.terminate(); worker = null; fail('The model could not start. Check your browser, available memory, and internet connection, then try again.'); };
  }
  return worker;
}
form.addEventListener('submit', event => {
  event.preventDefault();
  const text = prompt.value.trim();
  if (!text || pending) return;
  messages.push({ role: 'user', content: text });
  prompt.value = ''; prompt.style.height = ''; status.classList.remove('error');
  status.textContent = 'Starting Qwen…'; setPending(true); render();
  getWorker().postMessage({ type: 'generate', messages });
});
function newChat() { messages = []; status.textContent = ''; status.classList.remove('error'); prompt.value = ''; render(); prompt.focus(); }
reset.addEventListener('click', newChat);
mobileReset.addEventListener('click', newChat);
prompt.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); } });
prompt.addEventListener('input', () => { prompt.style.height = 'auto'; prompt.style.height = Math.min(prompt.scrollHeight, 160) + 'px'; });
document.querySelectorAll('[data-prompt]').forEach(button => button.addEventListener('click', () => { prompt.value = button.dataset.prompt; prompt.focus(); }));
render();
