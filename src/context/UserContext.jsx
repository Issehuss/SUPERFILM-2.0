import { createContext, useContext, useState, useEffect } from 'react';

const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [avatar, setAvatar] = useState(() => {
    return localStorage.getItem('userAvatar') || '/avatars/default.jpg';
  });

  const [user, setUser] = useState(() => {
    return {
      name: "Current User",
      roles: ['president'], // or ['vice_president']
      joinedClubs: [1], // Club IDs the user is part of
    };
  });

  useEffect(() => {
    localStorage.setItem('userAvatar', avatar);
  }, [avatar]);

  return (
    <UserContext.Provider value={{ avatar, setAvatar, user, setUser }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);

