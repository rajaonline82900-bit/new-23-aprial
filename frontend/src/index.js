import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      console.log('SW registered');
      // Check for updates every 5 minutes
      setInterval(() => reg.update(), 5 * 60 * 1000);
      // Auto-subscribe for push after login
      if (Notification.permission === 'granted') {
        subscribePush(reg);
      }
    }).catch(() => {});
  });
}

// Capture install prompt globally
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.deferredPrompt = e;
});

// Push subscription helper - fetches VAPID key from backend API
async function subscribePush(registration) {
  try {
    const API_URL = process.env.REACT_APP_BACKEND_URL;
    
    // Fetch VAPID key from backend
    let vapidKey = process.env.REACT_APP_VAPID_PUBLIC_KEY;
    try {
      const resp = await fetch(`${API_URL}/api/push/vapid-key`);
      if (resp.ok) {
        const data = await resp.json();
        if (data.key) vapidKey = data.key;
      }
    } catch (e) {
      console.log('Using env VAPID key');
    }
    
    if (!vapidKey) return;
    
    const urlBase64ToUint8Array = (base64String) => {
      const padding = '='.repeat((4 - base64String.length % 4) % 4);
      const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
      const rawData = window.atob(base64);
      return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
    };
    
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey)
    });
    
    await fetch(`${API_URL}/api/push/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ subscription: subscription.toJSON() })
    });
    console.log('Push subscription registered');
  } catch (e) {
    console.log('Push subscribe error:', e);
  }
}

window.subscribePush = subscribePush;
