import { Platform } from "react-native";

export const API_BASE =
  Platform.OS === "web"
    ? "http://localhost:8000"
    : "http://192.168.50.96:8000";



//export const API_BASE = "http://10.161.26.38:8000"; 
//const API_BASE = "https://vision.tail26a817.ts.net";
