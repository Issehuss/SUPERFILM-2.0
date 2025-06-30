// utils/slugify.js

export const slugify = (str) =>
    str
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')         // replace spaces with dashes
      .replace(/[^\w-]/g, '');      // remove special characters
  