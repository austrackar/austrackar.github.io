// ═══════════════════════════════════════════════
// FIREBASE CONFIG — AusTrack Flota
// ═══════════════════════════════════════════════
// 1. Andá a https://console.firebase.google.com
// 2. Entrá al proyecto rutaseguraar (Firebase Console)
// 3. Andá a Build > Authentication > Sign-in method
//    → Habilitá "Correo electrónico/contraseña" → Guardar
// 4. Andá a Build > Realtime Database > Reglas
//    → Pegá las reglas de abajo → Publicar
// ═══════════════════════════════════════════════
//
// Reglas para Realtime Database:
// {
//   "rules": {
//     "usuarios": { "$uid": { ".read": "$uid === auth.uid", ".write": "$uid === auth.uid" } },
//     "flota": { "$empresa": { ".read": "auth != null", ".write": "auth != null" } }
//   }
// }
// ═══════════════════════════════════════════════

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDmqMu0aYDKQU_dxzOS0hXqSe3V73N9Hek",
  authDomain: "rutaseguraar.firebaseapp.com",
  databaseURL: "https://rutaseguraar-default-rtdb.firebaseio.com",
  projectId: "rutaseguraar",
  storageBucket: "rutaseguraar.firebasestorage.app",
  messagingSenderId: "896624232126",
  appId: "1:896624232126:web:6fb248794418a1bbfa00ef"
};
