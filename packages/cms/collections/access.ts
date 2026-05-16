import type { Access, Where } from 'payload';

const PUBLISHED_ONLY: Where = {
  status: {
    equals: 'published',
  },
};

export const publishedOrAuthenticated: Access = ({ req }) => {
  if (req.user) {
    return true;
  }

  return PUBLISHED_ONLY;
};
