import { ClusterFeature, ClusterId, MovingObject, NotNowSplitTime, ObjectId, PositionedObject, SplitEvent, SplitTime, Timestamp, Vector } from "./types";
import { EventQueue } from "./EventQueue";
import FastPriorityQueue from "fastpriorityqueue";
import { Island } from "../interfaces";

// CONFIG
const MAX_AMOUNT_IN_CLUSTER_THRESHOLD = 200
const MAX_UPDATE = 60 * 1000
const INTERVAL = 5 * 1000
const AREA = 4800 * 4800
const AMOUNT_OF_CLOSEST_CLUSTERS = 10

// Implementation based on https://www.researchgate.net/profile/Dan-Lin-3/publication/3297750_Continuous_Clustering_of_Moving_Objects/links/5489bb320cf214269f1ab9f1/Continuous-Clustering-of-Moving-Objects.pdf
export class PaperArchipelago {

  private readonly clusters: Map<ClusterId, ClusterFeature[]> = new Map()
  private readonly objectsInCluster: Map<ClusterId, Set<ObjectId>> = new Map()
  private readonly objects: Map<ObjectId, MovingObject[]> = new Map()
  private readonly clusterForObject: Map<ObjectId, ClusterId> = new Map()
  private readonly queue: EventQueue = new EventQueue()
  private clusterIds: number = 0

  update(updates: MovingObject[], deletes: ObjectId[], currentTime: Timestamp) {
    const checkForMergeClusters: Set<ClusterId> = new Set()
    const checkForSplitClusters: Set<ClusterId> = new Set()

    // Handle deletions
    for (const id of deletes) {
      // Delete the object
      const dirtyCluster = this.delete(id);
      if (dirtyCluster) {
        checkForSplitClusters.add(dirtyCluster)
        checkForMergeClusters.add(dirtyCluster)
      }
    }

    // Handle updates
    for (const object of updates) {
      const isObjectKnown = this.objects.has(object.id)
      const extrapolate = this.extrapolate(object, currentTime)
      if (isObjectKnown) {
        const clusterId = this.clusterForObject.get(object.id)!

        // Mark cluster as dirty, to re-calculate
        checkForSplitClusters.add(clusterId)
        checkForMergeClusters.add(clusterId)

        // Update the object, and the cluster it's in
        this.updateObjectAndCluster(clusterId, extrapolate, currentTime);
      } else {
        // New object, we need to find or create a cluster for it
        const dirtyCluster = this.addObjectToSomeCluster(extrapolate);
        if (dirtyCluster) {
          checkForSplitClusters.add(dirtyCluster)
        }
      }
    }

    const toSplit: Set<ClusterId> = new Set()

    // Re calculate split times
    for (const clusterId of checkForSplitClusters) {
      if (this.clusters.has(clusterId)) { // We are checking if the cluster still exists, since it could have been deleted after being added to checkForSplitClusters
        const splitTime = this.splitTime(clusterId, currentTime);
        if (splitTime === 'now') {
          toSplit.add(clusterId)
        } else if (splitTime === 'never') {
          this.queue.remove(clusterId)
        } else {
          this.queue.addOrUpdate(clusterId, splitTime)
        }
      }
    }

    // Read queue to see if any of the non-modified clusters needs to be split
    let top: SplitEvent | undefined = this.queue.peek()
    while (top && top.splitTime < currentTime) {
      toSplit.add(top.cluster)
      this.queue.pop()
      top = this.queue.peek()
    }

    for (const clusterId of toSplit) {
      const newCluster = this.split(clusterId, currentTime);

      // Check both to see if I can merge them
      checkForMergeClusters.add(clusterId)
      checkForMergeClusters.add(newCluster)
    }

    for (const clusterId of checkForMergeClusters) {
      if (this.clusters.has(clusterId)) { // We are checking if the cluster still exists, since it could have been deleted after being added to checkForMergeClusters
        const mergeCandidate = this.canMerge(clusterId, currentTime);
        if (mergeCandidate) {
          this.merge(clusterId, mergeCandidate.cid, mergeCandidate.splitTime, mergeCandidate.merge);
        }
      }
    }
  }

  getIslands(): Island[] {
    // @ts-ignore
    return Array.from(this.objectsInCluster.values()).map(objects => ({ peers: Array.from(objects) }))
  }

  getIslandsCount() {
    return this.clusters.size
  }

  getPeersCount() {
    return this.objects.size
  }

  private delete(id: ObjectId): ClusterId | undefined {
    const clusterId = this.clusterForObject.get(id);
    if (clusterId) {
      const feature = this.clusters.get(clusterId)![0];
      const objectInTime = this.getMovingObjectInTime(id, feature.time);

      // Delete object
      this.clusterForObject.delete(id);
      this.objects.delete(id);

      // Check if the cluster will be left empty
      if (feature.amount === 1) {
        this.deleteCluster(clusterId);
        return
      }

      // Update the cluster
      this.removeObjectFromFeature(feature, objectInTime);
      this.objectsInCluster.get(clusterId)!.delete(id)

      // Return so that the cluster is marked as dirty
      return clusterId;
    } else {
      // Delete object
      this.clusterForObject.delete(id);
      this.objects.delete(id);
    }
  }

  private removeObjectFromFeature(feature: ClusterFeature, objectInTime: MovingObject) {
    feature.amount -= 1;
    feature.pos.x -= objectInTime.pos.x;
    feature.pos.y -= objectInTime.pos.y;
    feature.posSquared -= vectorSquared(objectInTime.pos);
    feature.velocity.x -= objectInTime.velocity.x;
    feature.velocity.y -= objectInTime.velocity.y;
    feature.velocitySquared -= vectorSquared(objectInTime.velocity);
    feature.posVelocity -= vectorMult(objectInTime.pos, objectInTime.velocity);
  }

  private updateObjectAndCluster(clusterId: ClusterId, object: MovingObject, currentTime: Timestamp) {
    const samples = this.objects.get(object.id)!
    const feature = this.getClusterFeatureInTime(clusterId, currentTime);

    // Calculate object position from previous sample
    const extrapolatedSample = this.getMovingObjectInTime(object.id, currentTime)

    // Update feature based on object's update
    feature.pos.x += object.pos.x - extrapolatedSample.pos.x;
    feature.pos.y += object.pos.y - extrapolatedSample.pos.y;
    feature.posSquared += vectorSquared(object.pos) - vectorSquared(extrapolatedSample.pos);
    feature.velocity.x += object.velocity.x - extrapolatedSample.velocity.x;
    feature.velocity.y += object.velocity.y - extrapolatedSample.velocity.y;
    feature.velocitySquared += vectorSquared(object.velocity) - vectorSquared(extrapolatedSample.velocity);
    feature.posVelocity += vectorMult(object.pos, object.velocity) - vectorMult(extrapolatedSample.pos, extrapolatedSample.velocity);

    // Add sample to list
    samples.unshift(object)

    // Remove old samples
    while (samples[samples.length - 1].time > currentTime + MAX_UPDATE) {
      samples.splice(samples.length - 1, 1)
    }
  }

  private addObjectToSomeCluster(object: MovingObject) {
    const closest = this.findClosest(object);
    if (closest && this.calculateDissimilarity([object], this.calculateCentersInCluster([closest.feature])) < this.pg()) {

      // Add object to cluster
      this.addObjectToFeature(closest.feature, object);

      // Update data
      this.clusterForObject.set(object.id, closest.id);
      this.objects.set(object.id, [object]);
      this.objectsInCluster.get(closest.id)!.add(object.id)

      // Return so that the cluster is marked as dirty
      return closest.id;
    } else {
      // Will create a new cluster for the new point
      this.createClusterForObject(object);
    }
  }

  private addObjectToFeature(feature: ClusterFeature, object: MovingObject) {
    feature.amount += 1;
    feature.pos.x += object.pos.x;
    feature.pos.y += object.pos.y;
    feature.posSquared += vectorSquared(object.pos);
    feature.velocity.x += object.velocity.x;
    feature.velocity.y += object.velocity.y;
    feature.velocitySquared += vectorSquared(object.velocity);
    feature.posVelocity += vectorMult(object.pos, object.velocity);
  }

  private merge(cid1: ClusterId, cid2: ClusterId, splitTime: NotNowSplitTime, mergeFeature: ClusterFeature) {
    // Update the merge feature
    this.clusters.get(cid1)![0] = mergeFeature

    // Move all objects from cluster 2 to cluster 1
    const objectsInCluster1 = this.objectsInCluster.get(cid1)!
    const objectsInCluster2 = this.objectsInCluster.get(cid2)!
    for (const object of objectsInCluster2) {
      this.clusterForObject.set(object, cid1)
      objectsInCluster1.add(object)
    }

    this.deleteCluster(cid2)

    if (splitTime === 'never') {
      this.queue.remove(cid1)
    } else {
      this.queue.addOrUpdate(cid1, splitTime)
    }
  }

  private canMerge(cid: ClusterId, currentTime: Timestamp):  { cid: ClusterId, merge: ClusterFeature, splitTime: NotNowSplitTime } | undefined {
    const nearestClusters: FastPriorityQueue<{ cid: ClusterId, distance: number }> = new FastPriorityQueue((cluster1, cluster2) => cluster1.distance < cluster2.distance)
    const amountInCluster = this.clusters.get(cid)![0].amount
    const centers = this.calculateCentersInCluster(this.clusters.get(cid)!)
    for (const [cid2, features] of this.clusters) {
      if (cid !== cid2 && features[0].amount + amountInCluster < MAX_AMOUNT_IN_CLUSTER_THRESHOLD) {
        const centers2 = this.calculateCentersInCluster(features)
        const distance = this.calculateDissimilarity(centers, centers2)
        nearestClusters.add({ cid: cid2, distance })
      }
    }

    let largestSplitTime: { cid: ClusterId, merge: ClusterFeature, splitTime: NotNowSplitTime } | undefined
    const feature1 = this.getClusterFeatureInTime(cid, currentTime)
    for (const { cid: candidateCid } of nearestClusters.kSmallest(AMOUNT_OF_CLOSEST_CLUSTERS)) {
      const feature2 = this.getClusterFeatureInTime(candidateCid, currentTime)

      const merge: ClusterFeature = {
        amount: feature1.amount + feature2.amount,
        pos: {
          x: feature1.pos.x + feature2.pos.x,
          y: feature1.pos.y + feature2.pos.y
        },
        posSquared: feature1.posSquared + feature2.posSquared,
        velocity: {
          x: feature1.velocity.x + feature2.velocity.x,
          y: feature1.velocity.y + feature2.velocity.y
        },
        velocitySquared: feature1.velocitySquared + feature2.velocitySquared,
        posVelocity: feature1.posVelocity + feature2.posVelocity,
        time: currentTime
      }
      const splitTime = this.splitTimeFeature(merge)
      if (splitTime !== 'now') {
        if (splitTime === 'never') {
          largestSplitTime = { cid: candidateCid, merge, splitTime }
          break
        } else if (!largestSplitTime || splitTime > largestSplitTime?.splitTime) {
          largestSplitTime = { cid: candidateCid, merge, splitTime }
        }
      }
    }
    return largestSplitTime
  }

  private split(cid: ClusterId, currentTime: Timestamp): ClusterId {
    const objects = Array.from(this.objectsInCluster.get(cid)!)
    let farthest!: { object1: ObjectId, object2: ObjectId, distance: number }
    for (let i = 0; i < objects.length; i++) {
      for (let j = i + 1; j < objects.length; j++) {
        const obj1 = this.objects.get(objects[i])!
        const obj2 = this.objects.get(objects[j])!
        const distance = this.calculateDissimilarity(obj1, obj2)
        if (!farthest || farthest.distance < distance) {
          farthest = { object1: objects[i], object2: objects[j], distance }
        }
      }
    }

    const seed1Id = farthest.object1
    const samplesSeed1 = this.objects.get(seed1Id)!
    const seed2Id = farthest.object2
    const samplesSeed2 = this.objects.get(seed2Id)!

    const feature1 = this.getClusterFeatureInTime(cid, currentTime)
    const objectsIn1 = this.objectsInCluster.get(cid)!

    // Delete seed 2 from cluster 1
    const object2 = this.getMovingObjectInTime(seed2Id, currentTime);
    this.removeObjectFromFeature(feature1, object2)
    objectsIn1.delete(seed2Id)

    const cid2 = this.clusterIds++
    const feature2: ClusterFeature = this.createFeatureFromObject(object2)
    const objectsIn2: Set<ObjectId> = new Set()

    // Add seed 2 to cluster 2
    this.clusterForObject.set(seed2Id, cid2);
    objectsIn2.add(seed2Id)

    for (let i = 0; i < objects.length; i++) {
      const objectId = objects[i]
      if (objectId !== farthest.object1 && objectId !== farthest.object2) {
        const samples = this.objects.get(objectId)!
        // Optimization: instead of re-calculating distances, maybe store them on the first step
        const distanceToSeed1 = this.calculateDissimilarity(samples, samplesSeed1)
        const distanceToSeed2 = this.calculateDissimilarity(samples, samplesSeed2)

        if (distanceToSeed1 > distanceToSeed2) {
          const objectToMove = this.getMovingObjectInTime(objectId, currentTime);

          // Remove from cluster 1
          objectsIn1.delete(objectId)
          this.removeObjectFromFeature(feature1, objectToMove)

          // Add to cluster 2
          this.clusterForObject.set(objectId, cid2);
          objectsIn2.add(objectId)
          this.addObjectToFeature(feature2, objectToMove)
        }
      }
    }

    this.clusters.set(cid2, [feature2])
    this.objectsInCluster.set(cid2, objectsIn2)

    return cid2
  }

  private deleteCluster(clusterId: number) {
    this.queue.remove(clusterId);
    this.clusters.delete(clusterId);
    this.objectsInCluster.delete(clusterId);
  }

  private splitTime(cid: ClusterId, currentTime: Timestamp): SplitTime {
    const feature = this.getClusterFeatureInTime(cid, currentTime)
    return this.splitTimeFeature(feature)
  }

  private splitTimeFeature(feature: ClusterFeature): SplitTime {
    if (feature.amount === 1) {
      return 'never'
    }
    const a = feature.velocitySquared - vectorSquared(feature.velocity) / feature.amount
    const b = 2 * (feature.posVelocity - vectorMult(feature.pos, feature.velocity) / feature.amount)
    const c = feature.posSquared - vectorSquared(feature.pos) / feature.amount
    const avgRadius = (delta: number) => (a * delta * delta + b * delta + c ) / feature.amount

    const ps2 = this.PsSquared()
    if (avgRadius(0) > ps2) {
      return 'now'
    } else if (avgRadius(MAX_UPDATE) < ps2) {
      return 'never'
    } else {
      return (-b + Math.sqrt(b * b + 4 * a * (c - ps2 * feature.amount))) / (2 * a)
    }
  }

  private getMovingObjectInTime(objectId: ObjectId, currentTime: Timestamp): MovingObject {
    const samples = this.objects.get(objectId)!
    const lastSample = samples[0]

    if (lastSample.time !== currentTime) {
      const previousSample = samples[0];
      return this.extrapolate(previousSample, currentTime)
    }
    return lastSample
  }

  private extrapolate(object: MovingObject, currentTime: Timestamp): MovingObject {
    const timeDiff = currentTime - object.time;

    return {
      id: object.id,
      pos: {
        x: object.pos.x + object.velocity.x * timeDiff,
        y: object.pos.y + object.velocity.y * timeDiff
      },
      velocity: object.velocity,
      time: currentTime
    };
  }

  /**
   * Take the last feature of a cluster and return it if its time matches the given timestamp.
   * If it doesn't, then update the feature and return it.
   */
  private getClusterFeatureInTime(clusterId: ClusterId, currentTime: Timestamp) {
    const features = this.clusters.get(clusterId)!
    const lastFeature = features[0]

    if (lastFeature.time !== currentTime) {
      const timeDiff = currentTime - lastFeature.time
      const newFeature: ClusterFeature = {
        amount: lastFeature.amount,
        pos: {
          x: lastFeature.pos.x + lastFeature.velocity.x * timeDiff,
          y: lastFeature.pos.y + lastFeature.velocity.y * timeDiff
        },
        posSquared: lastFeature.posSquared + 2 * lastFeature.posVelocity * timeDiff + lastFeature.velocitySquared * timeDiff * timeDiff,
        velocity: lastFeature.velocity,
        velocitySquared: lastFeature.velocitySquared,
        posVelocity: lastFeature.posVelocity = lastFeature.velocitySquared * timeDiff,
        time: currentTime
      }
      features.unshift(newFeature)

      // Remove old features
      while (features[features.length - 1].time > currentTime + MAX_UPDATE) {
        features.splice(features.length - 1, 1)
      }
      return newFeature
    }
    return lastFeature
  }

  private calculateCentersInCluster(features: ClusterFeature[]): PositionedObject[] {
    return features.map(feature => ({
      pos: this.clusterCenter(feature),
      time: feature.time
    }))
  }

  private calculateDissimilarity(object1: PositionedObject[], object2: PositionedObject[]) {
    // TODO:
    // * TENER EN CUENTA QUE PUEDEN HABER CASOS DONDE NO HAYA DATOS
    // * IGNORAR SI SON DEMASIADO VIEJOS
    let diff: number = 0
    for (let i = 0; i < Math.min(object1.length, object2.length); i++) {
      const weight = 1 / (i + 1)
      diff += weight * squaredDistance(object1[i].pos, object2[i].pos)
    }
    return diff
  }

  private createClusterForObject(object: MovingObject) {
    const clusterId = this.clusterIds++
    const feature: ClusterFeature = this.createFeatureFromObject(object)
    this.clusters.set(clusterId, [feature])
    this.clusterForObject.set(object.id, clusterId)
    this.objects.set(object.id, [object])
    this.objectsInCluster.set(clusterId, new Set([object.id]))
  }

  private createFeatureFromObject(object: MovingObject): ClusterFeature {
    return {
      amount: 1,
      pos: object.pos,
      posSquared: vectorSquared(object.pos),
      velocity: object.velocity,
      velocitySquared: vectorSquared(object.velocity),
      posVelocity: vectorMult(object.pos, object.velocity),
      time: object.time
    };
  }

  private findClosest(object: MovingObject): { id: ClusterId, feature: ClusterFeature } | undefined {
    let closest: { id: ClusterId, feature: ClusterFeature, distance: number } | undefined
    for (const id of this.clusters.keys()) {
      const feature = this.getClusterFeatureInTime(id, object.time)
      // Optimization: don't calculate distance if cluster is already full
      // Optimization: use more efficient data structure to find closest, instead of iterating through all
      const distance = squaredDistance(object.pos, this.clusterCenter(feature))
      const valid = feature.amount < MAX_AMOUNT_IN_CLUSTER_THRESHOLD && (!closest || distance < closest?.distance)
      if (valid) {
        closest = { id, feature, distance }
      }
    }
    return closest
  }

  private clusterCenter(feature: ClusterFeature): Vector {
    return vectorDividedByScalar(feature.pos, feature.amount);
  }

  private PsSquared() {
    const sc = AREA * MAX_AMOUNT_IN_CLUSTER_THRESHOLD / this.objects.size
    return sc / 2
  }

  private pg() {
    const sc = AREA * MAX_AMOUNT_IN_CLUSTER_THRESHOLD / this.objects.size
    let result = 0
    for (let i = 0; i < MAX_UPDATE / INTERVAL; i++) {
      const weight = 1 / (i + 1)
      result += weight * 4 * sc
    }
    return result
  }
}

const vectorSquared = (vector: Vector) => {
  return vectorMult(vector, vector)
}

const vectorMult = (v1: Vector, v2: Vector) => {
  return v1.x * v2.x + v1.y * v2.y
}

const vectorDividedByScalar = (vector: Vector, scalar: number) => {
  return {
    x: vector.x / scalar,
    y: vector.y / scalar
  }
}

const squaredDistance = (v1: Vector, v2: Vector) => {
  const xDiff = v1.x - v2.x
  const yDiff = v1.y - v2.y

  return xDiff * xDiff + yDiff * yDiff
}
