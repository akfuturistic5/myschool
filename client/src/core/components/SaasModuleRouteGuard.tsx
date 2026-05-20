import { useEffect, type ReactNode } from 'react';
import { useSelector } from 'react-redux';
import { selectUser } from '../data/redux/authSlice';
import { isModuleRouteLocked, type SaasRoutableModuleKey } from '../utils/saasModuleAccess';
import SaasModuleLockPage from './SaasModuleLockPage';
import './saasModuleLock.css';

type Props = {
  moduleKey: SaasRoutableModuleKey;
  children: ReactNode;
};

const SaasModuleRouteGuard = ({ moduleKey, children }: Props) => {
  const user = useSelector(selectUser);
  const locked = isModuleRouteLocked(user?.saas_modules, moduleKey);

  useEffect(() => {
    if (!locked) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [locked]);

  return (
    <div className={`saas-module-guard${locked ? ' saas-module-guard--locked' : ''}`}>
      <div
        className={locked ? 'saas-module-guard__content saas-module-guard__content--locked' : 'saas-module-guard__content'}
        aria-hidden={locked ? true : undefined}
      >
        {children}
      </div>
      {locked && <SaasModuleLockPage moduleKey={moduleKey} />}
    </div>
  );
};

export default SaasModuleRouteGuard;
