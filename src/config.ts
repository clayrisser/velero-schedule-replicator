export interface Config {
  veleroNamespace: string;
  debug: boolean;
}

const { env } = process;
const config: Config = {
  veleroNamespace: env.VELERO_NAMESPACE || 'velero',
  debug: env.DEBUG_OPERATOR?.toLowerCase() === 'true'
};

export default config;
