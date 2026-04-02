// Voice utility - speaks button text on click using Web Speech API (Hindi female voice)
let voices = [];

const loadVoices = () => {
  voices = window.speechSynthesis?.getVoices() || [];
};

if (typeof window !== 'undefined' && window.speechSynthesis) {
  loadVoices();
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

export const speak = (text) => {
  if (!window.speechSynthesis || !text) return;
  
  window.speechSynthesis.cancel();
  
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'hi-IN';
  utterance.rate = 1.1;
  utterance.pitch = 1.2;
  
  // Try to find Hindi female voice
  const hindiVoice = voices.find(v => v.lang.includes('hi') && v.name.toLowerCase().includes('female'))
    || voices.find(v => v.lang.includes('hi'))
    || voices.find(v => v.name.toLowerCase().includes('female'))
    || voices[0];
  
  if (hindiVoice) utterance.voice = hindiVoice;
  
  window.speechSynthesis.speak(utterance);
};
