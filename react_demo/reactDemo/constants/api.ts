import { Platform } from "react-native";

export const API_BASE =
  Platform.OS === "web"
    ? "http://localhost:8000"
    : "http://100.108.72.102:8000";

//export const API_BASE =  "http://100.108.72.102:8000";
//"http://192.0.0.2:8000";// Mac_school
//"http://192.168.50.96:8000"; // mac homes
//PC home"http://192.168.50.206:8000";
//"https://vision.tail26a817.ts.net";