
import { useState, useEffect, type CSSProperties } from 'react';
import { img_path} from '../../../environment';

function resolveInitialSrc(raw: string): string {
  const s = (raw || '').trim();
  if (!s) return `${img_path}`;
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith('/')) return s;
  return `${img_path}${s}`;
}

interface Image {
  className?: string;
  src: string;
  alt?: string;
  height?: number;
  width?: number;
  id?:string;
  gender?: string;
  style?: CSSProperties;
}

const ImageWithBasePath = (props: Image) => {
  const [imgSrc, setImgSrc] = useState(() => resolveInitialSrc(props.src));
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
    setImgSrc(resolveInitialSrc(props.src));
  }, [props.src]);

  // Function to get default avatar based on gender
  const getDefaultAvatar = (gender?: string) => {
    switch (gender?.toLowerCase()) {
      case 'male':
        return `${img_path}assets/img/profiles/avatar-01.jpg`; // Using existing avatar
      case 'female':
        return `${img_path}assets/img/profiles/avatar-02.jpg`; // Using existing avatar
      default:
        return `${img_path}assets/img/profiles/avatar-01.jpg`;
    }
  };

  const handleImageError = () => {
    if (!hasError) {
      setHasError(true);
      setImgSrc(getDefaultAvatar(props.gender));
    }
  };

  return (
    <img
      className={props.className}
      src={imgSrc}
      height={props.height}
      alt={props.alt}
      width={props.width}
      id={props.id}
      style={props.style}
      onError={handleImageError}
    />
  );
};

export default ImageWithBasePath;
