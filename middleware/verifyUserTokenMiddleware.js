import jwt from 'jsonwebtoken'

const verifyUserTokenMiddleware = (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];

        if (!token) {
            return res.status(422).json({ msg: 'auth token required', responseStatus: 'failed' });
        }

        const decoded = jwt.verify(token, process.env.TOKEN_SECRET_KEY);

        req.userData = decoded;
        next();
        
    } catch (error) {
        console.log('Internal server error in multiversePortRateLimit');
        return res.status(401).json({ msg: 'Token verification failed ', responseStatus: 'failed' });
    }
}

export {verifyUserTokenMiddleware}