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

  labelNamespace = 'dev.siliconhills.velero';

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
                schedule.metadata?.labels?.[
                  `${this.labelNamespace}/fromNamespace`
                ]
            )
          );
          if (e.meta.namespace !== this.config.veleroNamespace) {
            switch (e.type) {
              case ResourceEventType.Added: {
                if (fromNamespaceSet.has(e.meta.namespace)) break;
                const message = `schedule '${e.meta.name}' from namespace '${e.meta.namespace}'`;
                this.spinner.start(`CLONING ${message}`);
                await this.addVeleroSchedule(veleroScheduleObject);
                this.spinner.succeed(`CLONED ${message}`);
                break;
              }
              case ResourceEventType.Modified: {
                if (!fromNamespaceSet.has(e.meta.namespace)) break;
                const message = `schedule '${e.meta.name}' in namespace '${this.config.veleroNamespace}'`;
                this.spinner.start(`MODIFYING ${message}`);
                await this.modifyVeleroSchedule(veleroScheduleObject);
                this.spinner.succeed(`MODIFYING ${message}`);
                break;
              }
              case ResourceEventType.Deleted: {
                if (!fromNamespaceSet.has(e.meta.namespace)) break;
                const message = `schedule '${e.meta.name}' from namespace '${this.config.veleroNamespace}'`;
                this.spinner.start(`DELETING ${message}`);
                await this.deleteVeleroSchedule(veleroScheduleObject);
                this.spinner.succeed(`DELETED ${message}`);
                break;
              }
            }
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

  protected async addVeleroSchedule({
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
            [`${this.labelNamespace}/fromNamespace`]: metadata?.namespace,
            ...(metadata?.labels || {})
          }
        },
        spec
      }
    );
  }

  protected async modifyVeleroSchedule(
    veleroScheduleObject: VeleroScheduleObject
  ): Promise<void> {
    const { apiVersion, metadata, spec } = veleroScheduleObject;
    if (!metadata?.name || !metadata?.namespace) return;
    const { body } = await this.objectApi.read({
      apiVersion,
      kind: this.kind,
      metadata: {
        name: metadata?.name,
        namespace: this.config.veleroNamespace,
        annotations: metadata?.annotations || {},
        labels: metadata.labels || {}
      }
    });
    await this.customObjectsApi.patchNamespacedCustomObject(
      this.group,
      this.version,
      this.config.veleroNamespace,
      this.plural,
      metadata.name,
      [
        {
          op: 'replace',
          path: '/metadata/labels',
          value: {
            ...(metadata?.labels || {}),
            ...(body.metadata?.labels || {})
          }
        },
        {
          op: 'replace',
          path: '/metadata/annotations',
          value: {
            ...(metadata.annotations || {}),
            ...(body.metadata?.annotations || {})
          }
        },
        {
          op: 'replace',
          path: '/spec',
          value: spec
        }
      ],
      undefined,
      undefined,
      undefined,
      { headers: { 'Content-Type': 'application/json-patch+json' } }
    );
  }

  protected async deleteVeleroSchedule({
    metadata
  }: VeleroScheduleObject): Promise<void> {
    if (!metadata?.name) return;
    await this.customObjectsApi.deleteNamespacedCustomObject(
      this.group,
      this.version,
      this.config.veleroNamespace,
      this.plural,
      metadata?.name
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
