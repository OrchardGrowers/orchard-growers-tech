let locked = false;

export const acquireRepositoryWriteLock = () => {
  if (locked) {
    const error = new Error("Another repository write is already in progress");
    error.statusCode = 409;
    error.code = "REPOSITORY_WRITE_LOCKED";
    throw error;
  }
  locked = true;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    locked = false;
  };
};

export const isRepositoryWriteLocked = () => locked;
