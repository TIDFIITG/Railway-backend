const AdminAuth = (req, res, next) => {
    if (req.role !== "admin") {
        return res.status(403).json({
            success: false,
            message: "Access denied. Admin privileges required."
        });
    }

    next();
};

export default AdminAuth;