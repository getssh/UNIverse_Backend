exports.getResourceTypeFromMime = (mimetype) => {
  if (!mimetype) return 'raw';

  const type = mimetype.split('/')[0];

  switch (type) {
      case 'image':
          return 'image';
      case 'video':
          return 'video';
      default:
          return 'raw';
  }
};