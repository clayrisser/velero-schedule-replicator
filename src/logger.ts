import { OperatorLogger } from '@dot-i/k8s-operator';

export default class Logger implements OperatorLogger {
  info(message: string) {
    console.info(message);
  }

  debug(message: string) {
    console.debug(message);
  }

  warn(message: string) {
    console.warn(message);
  }

  error(message: string) {
    console.error(message);
  }
}
