import {
  Mail,
  Phone,
  MapPin
} from "lucide-react";
import {
  motion
} from "framer-motion";
import {
  Link
} from "react-router-dom";
function Footer() {
  return (
      <footer className="bg-gray-100 text-gray-700 py-8 px-6">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center text-center md:text-left">
              <div>
                  <h2 className="text-2xl font-bold">NovaLand</h2>
                  <p className="text-gray-500 mt-2">The Future of Real Estate, Reimagined</p>
              </div>
              {/*links*/}
              <nav className="my-6 md:my-0">
                  <ul className="flex space-x-6 text-lg">
                      <Link to="/">
                          <motion.li whileHover={{
                              scale: 1.1
                          }} className="cursor-pointer hover:text-purple-500 transition">
                              Home
                          </motion.li>
                      </Link>
                      <Link to="/explore">
                          <motion.li whileHover={{
                              scale: 1.1
                          }} className="cursor-pointer hover:text-purple-500 transition">
                              Explore
                          </motion.li>
                      </Link>
                      <motion.li whileHover={{
                          scale: 1.1
                      }} className="cursor-pointer hover:text-purple-500 transition">
                          Categories
                      </motion.li>
                      <motion.li whileHover={{
                          scale: 1.1
                      }} className="cursor-pointer hover:text-purple-500 transition">
                          About
                      </motion.li>
                  </ul>
              </nav>

              {/*contact*/}
              <div className="text-gray-500">
                  <p className="flex items-center justify-center md:justify-start">
                      <MapPin className="w-5 h-5 mr-2" /> Kochi, India
                  </p>
                  <p className="flex items-center justify-center md:justify-start mt-2">
                      <Phone className="w-5 h-5 mr-2" /> +91 9999 8888
                  </p>
                  <p className="flex items-center justify-center md:justify-start mt-2">
                      <Mail className="w-5 h-5 mr-2" /> support@NovaLand.com
                  </p>
              </div>

          </div>

          {/* Bottom Line */}
          <div className="border-t border-gray-300 mt-6 pt-4 text-center text-gray-500 text-sm">
              © {new Date().getFullYear()} NovaLand. All rights reserved.
          </div>
      </footer>
  );
}

export default Footer;