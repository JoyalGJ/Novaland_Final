import { Search } from 'lucide-react';
import { motion } from 'framer-motion';
import { useState } from "react";
function SearchBar(){
    const [searchQuery,setSearchQuery] = useState(""); 
    return(<div className="flex justify-center">
        <input 
            type="text" 
            placeholder="Search for Properties" 
            className="p-3 border border-gray-300 rounded-md w-full sm:w-3/4 md:w-3/4 lg:w-1/2"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
        />
        <motion.button
          className="flex items-center justify-center w-12 h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-full ml-4"
          whileHover={{ scale: 1.2 }}
          whileTap={{ scale: 0.9 }}
        >
        <Search className="w-6 h-6" />
        </motion.button>
        </div>
     );
}
export default SearchBar