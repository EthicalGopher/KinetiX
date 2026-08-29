import React from 'react';
import NiceAvatar, { genConfig } from 'react-nice-avatar';

interface AvatarProps {
  username: string;
  size?: number;
}

const SeededAvatar: React.FC<AvatarProps> = ({ username, size = 36 }) => {
  const config = genConfig(username.trim() || 'guest');

  return <NiceAvatar style={{ width: size, height: size }} {...config} />;
};

export { SeededAvatar as Avatar };
