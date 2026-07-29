const currentDate = (): string => {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
};

export { currentDate };
