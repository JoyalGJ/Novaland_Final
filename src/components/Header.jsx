import { useState } from "react";
import {
    Bell,
    ChevronDown,
    Home,
    Compass,
    Info,
    Menu,
    X,
    Building,
    MapPin,
    LandPlot,
    LayoutDashboard
} from "lucide-react";
import {
    motion
} from "framer-motion";
import {
    Link,
    useNavigate
} from "react-router-dom";
import logo from "../assets/logo.ico";

function Header({
    notificationCount
}) {
    const [menuOpen, setMenuOpen] = useState(false);
    const navigate = useNavigate();

    const handleExploreClick = () => {
        navigate("/explore");
    };

    const handleAboutClick = () => {
        navigate("/about");
    };

    const handleCategoriesClick = () => {
        // Logic for categories can be added here
    };

    return (
        <header className="bg-white text-gray-800 py-4 px-6 flex items-center justify-between shadow-md z-50 relative">
            {/* Left: Logo */}
            <div className="flex-shrink-0">
                <Link to="/">
                    <motion.img
                        src={logo}
                        width="50"
                        height="50"
                        alt="Logo"
                        className="cursor-pointer transition-transform duration-200 hover:scale-110"
                        animate={{
                            rotate: [0, 10, -10, 0]
                        }}
                    />
                </Link>
            </div>

            {/* Center: Navigation Menu */}
            <nav className="hidden md:flex flex-1 justify-center absolute left-1/2 transform -translate-x-1/2">
                <ul className="flex space-x-10 text-lg font-semibold">
                    <motion.li className="cursor-pointer flex items-center hover:text-purple-500 transition-colors duration-200" whileHover={{
                        scale: 1.1
                    }}>
                        <Link to="/" className="flex items-center">
                            <Home className="w-5 h-5 mr-2 text-purple-500" /> Home
                        </Link>
                    </motion.li>

                    <motion.li className="cursor-pointer flex items-center hover:text-purple-500 transition-colors duration-200" whileHover={{
                        scale: 1.1
                    }} onClick={handleExploreClick}>
                        <Compass className="w-5 h-5 mr-2 text-purple-500" /> Explore
                    </motion.li>

                    {/* Categories Dropdown */}

                    <motion.li className="cursor-pointer flex items-center hover:text-purple-500 transition-colors duration-200" whileHover={{
                        scale: 1.1
                    }} onClick={handleAboutClick}>
                        <Info className="w-5 h-5 mr-2 text-purple-500" /> About
                    </motion.li>
                </ul>
            </nav>

            {/* Right: Sign Up, Log In, Profile, Bell */}
            <div className="flex-shrink-0">
                <div className="hidden md:flex items-center space-x-4">
                    <motion.div whileHover={{
                        rotate: 15
                    }}>
                        <Link to="/dashboard" className="flex items-center hover:text-purple-500">
                            <LayoutDashboard className="w-6 h-6 cursor-pointer hover:text-purple-500 mr-2" />
                            Dashboard
                        </Link>
                    </motion.div>
                    <motion.div whileHover={{
                        rotate: 15
                    }} className="relative">
                        <Bell className="w-8 h-8 cursor-pointer hover:text-purple-500" onClick={() => alert("Clicked")} />
                        {notificationCount > 0 && (
                            <span className="absolute top-0 right-0 bg-red-500 text-white rounded-full text-xs px-1.5 py-0.5">
                                {notificationCount}
                            </span>
                        )}
                    </motion.div>
                </div>
            </div>

            {/* Mobile Menu Button */}
            <button className="md:hidden text-gray-800" onClick={() => setMenuOpen(!menuOpen)}>
                {menuOpen ? <X className="w-8 h-8" /> : <Menu className="w-8 h-8" />}
            </button>
        </header>
    );
}

export default Header;