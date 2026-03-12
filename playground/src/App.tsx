import { Routes, Route } from "react-router-dom";
import { ToastContainer } from 'react-toastify';
import Designer from "./routes/Designer";

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <Routes>
        <Route path={"/"} element={<Designer />} />
        <Route path={"/designer"} element={<Designer />} />
      </Routes>
      <ToastContainer />
    </div>
  );
}
