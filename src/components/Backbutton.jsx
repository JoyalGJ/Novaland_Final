import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

function BackButton() {
  const navigate = useNavigate(); 
  return (
    <button 
      onClick={() => navigate(-1)}
      className="absolute top-4 left-4 p-2 bg-gray-200 hover:bg-gray-300 rounded-full shadow-md transition"
    >
      <ArrowLeft className="w-6 h-6 text-gray-700" />
    </button>
  );
}
export default BackButton;