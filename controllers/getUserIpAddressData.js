const getUserIpAddressData = (req, res) => {
  try {
    let ip = req.headers['x-forwarded-for']
      ? req.headers['x-forwarded-for'].split(',')[0].trim()
      : req.ip;

    // Normalize IPv6 localhost and IPv4-mapped IPv6 addresses
    if (ip === '::1' || ip === '::ffff:127.0.0.1') {
      ip = '127.0.0.1';
    } else if (ip.startsWith('::ffff:')) {
      ip = ip.replace('::ffff:', '');
    }

    return res.status(200).json({
      msg: 'IP data fetched successfully',
      ip,
      responseStatus: 'success',
    });
  } catch (error) {
    console.error('Internal server error in getUserIpAddressData:', error);
    return res.status(500).json({
      msg: 'Internal server error',
      responseStatus: 'failed',
    });
  }
};

export { getUserIpAddressData };
