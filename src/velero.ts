import * as k8s from '@kubernetes/client-node';
import Operator, { ResourceEventType } from '@dot-i/k8s-operator';
import ora from 'ora';
import Logger from './logger';
import { Config } from './config';
import { VeleroScheduleObject } from './types';

export default class VeleroOperator extends Operator {
  objectApi: k8s.KubernetesObjectApi;

  customObjectsApi: k8s.CustomObjectsApi;

  group = 'velero.io';

  version = 'v1';

  plural = 'schedules';

  kind = 'Schedule';

  spinner = ora();

  constructor(protected config: Config, protected log = new Logger()) {
    super(log);
    this.objectApi = k8s.KubernetesObjectApi.makeApiClient(this.kubeConfig);
    this.customObjectsApi = this.kubeConfig.makeApiClient(k8s.CustomObjectsApi);
  }

  protected async init() {
    await this.watchResource(
      this.group,
      this.version,
      this.plural,
      async (e) => {
        const veleroScheduleObject = e.object as VeleroScheduleObject;
        try {
          const veleroSchedules = await this.getVeleroSchedules();
          const fromNamespaceSet = new Set(
            veleroSchedules.map(
              (schedule: VeleroScheduleObject) =>
                schedule.metadata?.labels?.['dev.siliconhills/fromNamespace']
            )
          );
          if (
            e.meta.namespace !== this.config.veleroNamespace &&
            e.type === ResourceEventType.Added &&
            !fromNamespaceSet.has(e.meta.namespace)
          ) {
            const message = `schedule '${e.meta.name}' from namespace '${e.meta.namespace}'`;
            this.spinner.start(`cloning ${message}`);
            await this.createVeleroSchedule(veleroScheduleObject);
            this.spinner.succeed(`cloned ${message}`);
          }
        } catch (err) {
          this.spinner.fail(
            [err.message || '', err.body?.message || ''].join(': ')
          );
          if (this.config.debug) this.log.error(err);
        }
      }
    );
  }

  protected async createVeleroSchedule({
    apiVersion,
    metadata,
    spec
  }: VeleroScheduleObject): Promise<void> {
    await this.customObjectsApi.createNamespacedCustomObject(
      this.group,
      this.version,
      this.config.veleroNamespace,
      this.plural,
      {
        apiVersion,
        kind: this.kind,
        metadata: {
          name: metadata?.name,
          namespace: this.config.veleroNamespace,
          annotations: metadata?.annotations || {},
          labels: {
            'dev.siliconhills/fromNamespace': metadata?.namespace,
            ...(metadata?.labels || {})
          }
        },
        spec
      }
    );
  }

  protected async getVeleroSchedules(): Promise<VeleroScheduleObject[]> {
    const { body } = await this.customObjectsApi.listNamespacedCustomObject(
      this.group,
      this.version,
      this.config.veleroNamespace,
      this.plural
    );
    return (body as any).items;
  }
}
