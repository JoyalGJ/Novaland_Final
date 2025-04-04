import React from "react";
const AboutPage = () => {
    return (
        <div style={styles.pageContainer}>
            <div style={styles.heroSection}>
                <h1 style={styles.title}>About NovaLand</h1>
                <p style={styles.subtitle}>Revolutionizing Real Estate Transactions with Blockchain</p>
            </div>

            {/* About Novaland */}
            <div style={styles.contentSection}>
                <h2 style={styles.heading}>What is NovaLand?</h2>
                <p style={styles.text}>
                    NovaLand is a blockchain-powered real estate marketplace designed to make property
                    transactions secure, transparent, and efficient. By leveraging blockchain technology,
                    NovaLand eliminates intermediaries, reduces paperwork, and enables seamless property
                    buying and selling on a global scale.
                </p>
            </div>

            {/* Why Choose Novaland? */}
            <div style={styles.contentSection}>
                <h2 style={styles.heading}>Why Choose NovaLand?</h2>
                <ul style={styles.list}>
                    <li style={styles.listItem}>🔹 Decentralized & Secure – Transactions are recorded on the blockchain, ensuring immutability and transparency.</li>
                    <li style={styles.listItem}>🔹 Tokenized Property Ownership – Properties are represented as blockchain tokens, allowing for easy and secure transfers.</li>
                    <li style={styles.listItem}>🔹 Smart Contract Automation – Eliminates the need for middlemen by automating property transactions.</li>
                    <li style={styles.listItem}>🔹 Real-time Buyer-Seller Interaction – Built-in chat and proposal management enable smooth negotiations.</li>
                    <li style={styles.listItem}>🔹 Global Accessibility – Users can buy and sell properties across borders using cryptocurrency payments.</li>
                </ul>
            </div>

            {/* Key Features */}
            <div style={styles.contentSection}>
                <h2 style={styles.heading}>Key Features</h2>
                <ul style={styles.list}>
                    <li style={styles.listItem}>🔹 Wallet-based Authentication – Secure login using blockchain wallets.</li>
                    <li style={styles.listItem}>🔹 Property Listing & Management – Sellers can tokenize and list properties for sale.</li>
                    <li style={styles.listItem}>🔹 Property Browsing & Purchase – Buyers can explore properties and make secure offers.</li>
                    <li style={styles.listItem}>🔹 Smart Contract Execution – Payments and ownership transfers are automated and tamper-proof.</li>
                    <li style={styles.listItem}>🔹 Real-time Communication – Chat feature for buyers and sellers to negotiate deals efficiently.</li>
                </ul>
            </div>

            {/* How It Works */}
            <div style={styles.contentSection}>
                <h2 style={styles.heading}>How It Works</h2>
                <p style={styles.text}>
                    1️⃣ Sign Up – Users connect their blockchain wallets to access the platform.<br />
                    2️⃣ List or Browse Properties – Sellers upload property details while buyers explore listings.<br />
                    3️⃣ Submit Offers & Negotiate – Buyers submit offers, and sellers review and accept.<br />
                    4️⃣ Smart Contract Execution – Transactions are securely recorded on the blockchain.<br />
                    5️⃣ Ownership Transfer – Property ownership is transferred transparently and efficiently.
                </p>
            </div>

            {/* Our Mission */}
            <div style={styles.contentSection}>
                <h2 style={styles.heading}>Our Mission</h2>
                <p style={styles.text}>
                    NovaLand aims to transform the real estate industry by making property transactions
                    accessible, efficient, and fraud-proof. With blockchain technology, NovaLand provides a
                    decentralized and transparent marketplace that empowers users to buy and sell properties
                    with confidence.
                </p>
            </div>

            {/* Team Members */}
            <div style={styles.contentSection}>
                <h2 style={styles.heading}>Meet the Team</h2>
                <ul style={styles.list}>
                    <li style={styles.listItem}>👨‍💻 Eby J Kavungal</li>
                    <li style={styles.listItem}>👨‍💻 Franklin Davis Achandy</li>
                    <li style={styles.listItem}>👨‍💻 Joyal George Joseph</li>
                    <li style={styles.listItem}>👨‍💻 Kiran K M</li>
                </ul>
            </div>
        </div>
    );
};

const styles = {
    pageContainer: {
        fontFamily: "Arial, sans-serif",
        backgroundColor: "#f9fafb", // Light Gray
        color: "#374151", // Dark Gray
        minHeight: "100vh",
        padding: "20px",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
    },
    heroSection: {
        textAlign: "center",
        padding: "40px 20px",
        backgroundColor: "#ffffff", // White
        borderRadius: "10px",
        boxShadow: "0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px 0 rgba(0,0,0,0.06)",
    },
    title: {
        fontSize: "2.5rem",
        fontWeight: "bold",
        marginBottom: "10px",
        color: "#4a5568", // Dark Gray
    },
    subtitle: {
        fontSize: "1.2rem",
        opacity: "0.8",
        color: "#718096", // Medium Gray
    },
    contentSection: {
        marginTop: "30px",
        backgroundColor: "#ffffff", // White
        padding: "20px",
        borderRadius: "8px",
        boxShadow: "0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px 0 rgba(0,0,0,0.06)",
    },
    heading: {
        fontSize: "1.8rem",
        borderBottom: "2px solid #edf2f7", // Light Gray
        paddingBottom: "5px",
        marginBottom: "10px",
        color: "#4a5568", // Dark Gray
    },
    text: {
        fontSize: "1.1rem",
        lineHeight: "1.6",
        color: "#4a5568", // Dark Gray
    },
    list: {
        paddingLeft: "20px",
    },
    listItem: {
        fontSize: "1.1rem",
        marginBottom: "8px",
        color: "#4a5568", // Dark Gray
    },
};

export default AboutPage;