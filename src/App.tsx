import { Routes, Route, useLocation } from "react-router-dom";
import Admin from "./pages/Admin.tsx"; // Adjust this path to match your project

function App() {
const location = useLocation();

return ( 
    <div className="App"> 
    <Routes location={location} key={location.pathname}>
    <Route path="/" element={<Admin />} /> </Routes> </div>
);
}

export default App;
