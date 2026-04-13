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
    let vapidKey = null;
    try {
      const resp = await fetch(`${API_URL}/api/push/vapid-key`);
      if (resp.ok) {
        const data = await resp.json();
        if (data.key) vapidKey = data.key;
      }
    } catch (e) {
      console.error('VAPID key fetch failed:', e);
    }
    
    if (!vapidKey) {
      console.error('No VAPID key available - push subscription aborted');
      return;
    }
    
    const urlBase64ToUint8Array = (base64String) => {
      const padding = '='.repeat((4 - base64String.length % 4) % 4);
      const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
      const rawData = window.atob(base64);
      return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
    };
    
    // Check if already subscribed
    const existingSub = await registration.pushManager.getSubscription();
    let subscription = existingSub;
    
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey)
      });
      console.log('New push subscription created');
    } else {
      console.log('Using existing push subscription');
    }
    
    const headers = { 'Content-Type': 'application/json' };
    const token = localStorage.getItem('matka11_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    } else {
      console.error('No auth token found - push subscribe will fail');
      return;
    }
    
    const subResp = await fetch(`${API_URL}/api/push/subscribe`, {
      method: 'POST',
      headers: headers,
      credentials: 'include',
      body: JSON.stringify({ subscription: subscription.toJSON() })
    });
    if (subResp.ok) {
      console.log('Push subscription registered successfully');
    } else {
      const errData = await subResp.text();
      console.error('Push subscribe failed:', subResp.status, errData);
    }
  } catch (e) {
    console.error('Push subscribe error:', e.message || e);
  }
}

window.subscribePush = subscribePush;
