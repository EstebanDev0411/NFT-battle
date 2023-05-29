import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/firestore";
import admin from "firebase-admin";
import serviceAccount from "./serviceAccountKey.json";

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as any),
  databaseURL: "https://nft-battle-game-default-rtdb.firebaseio.com",
  
});
const firebaseConfig = {
  apiKey: "AIzaSyDcSAbMX7TnQwfKkDlNog8uTMvg_UOpfpU",
  authDomain: "nft-battle-game.firebaseapp.com",
  projectId: "nft-battle-game",
  storageBucket: "nft-battle-game.appspot.com",
  messagingSenderId: "683037004134",
  appId: "1:683037004134:web:07b048158a53891ff338a7",
  measurementId: "G-SFDM5NHFCQ"
};

firebase.initializeApp(firebaseConfig);

export default firebase;
