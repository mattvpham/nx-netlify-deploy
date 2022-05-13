import styles from './shared.module.css';

/* eslint-disable-next-line */
export interface SharedProps {}

export function Shared(props: SharedProps) {
  return (
    <div className={styles['container']}>
      <h1>This is a shared component!</h1>
    </div>
  );
}

export default Shared;
