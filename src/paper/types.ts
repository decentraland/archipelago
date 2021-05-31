
export type ObjectId = string
export type ClusterId = number

export type Vector = {
  x: number,
  y: number
}

export type MovingObject = {
  id: ObjectId // Known as OID on the paper
  pos: Vector // Known as X on the paper
  velocity: Vector // Known as V on the paper
  time: Timestamp // Known as t on the paper
}

export type ClusterFeature = {
  amount: number // Number of moving objects in the cluster. Known as N on the paper
  pos: Vector // Known as CX on the paper
  posSquared: number // Known as CX^2 on the paper
  velocity: Vector // Known as CV on the paper
  velocitySquared: number // Known as CV^2 on the paper
  posVelocity: number // Known as CXV on the paper
  time: Timestamp // Known as t on the paper
}

export type PositionedObject = {
  pos: Vector
  time: Timestamp
}

export type Timestamp = number

export type SplitTime = Timestamp | 'now' | 'never'
export type NotNowSplitTime = Exclude<SplitTime, 'now'>

export type SplitEvent = { cluster: ClusterId, splitTime: Timestamp }