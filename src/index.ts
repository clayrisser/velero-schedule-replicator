import Velero from './velero';
import config from './config';

(async () => {
  const velero = new Velero(config);
  await velero.start();

  function exit(_reason: string) {
    velero.stop();
    process.exit(0);
  }

  process
    .on('SIGTERM', () => exit('SIGTERM'))
    .on('SIGINT', () => exit('SIGINT'));
})().catch(console.error);
