import { KubernetesObject } from '@kubernetes/client-node';

export interface VeleroScheduleSpec {
  [key: string]: any;
}

export interface VeleroScheduleObject extends KubernetesObject {
  spec: VeleroScheduleSpec;
}
