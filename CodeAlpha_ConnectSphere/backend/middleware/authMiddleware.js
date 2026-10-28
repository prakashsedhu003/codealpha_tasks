const jwt = require('jsonwebtoken');

function authenticateToken(req, res, next) {
  const authorization = req.headers.authorization || '';
  const [scheme, token] = authorization.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({
      status: 'error',
      message: 'Please log in to continue.'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded.id) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid login token.'
      });
    }

    req.user = {
      id: decoded.id,
      username: decoded.username
    };

    next();
  } catch (error) {
    return res.status(401).json({
      status: 'error',
      message: 'Your session has expired. Please log in again.'
    });
  }
}

module.exports = authenticateToken;