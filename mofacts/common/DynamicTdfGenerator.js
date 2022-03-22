import {KC_MULTIPLE} from './Definitions';

export class DynamicTdfGenerator {
  constructor(parentTdfJson, fileName, ownerId, source, stimJson) {
    /** @private {object} */
    this.parentTdfJson_ = parentTdfJson;

    /** @private @const {object} */
    this.parentTutor_ = this.parentTdfJson_.tutor;

    /** @private @const {array} */
    this.parentSetSpec_ = this.parentTutor_.setspec;

    /** @private @const {array} */
    this.parentUnits_ = this.parentTutor_.unit;

    /** @private @const {array} */
    this.parentGeneratedTdfs_ = this.parentTutor_.generatedtdfs[0].generatedtdf;

    /** @private @const {string} */
    this.parentStimFileName_ = this.parentSetSpec_.stimulusfile;

    /** @private @const {string} */
    this.fileName_ = fileName;

    /** @private @const {string}*/
    this.ownerId_ = ownerId;

    /** @private @const {string} */
    this.source_ = source;

    /** @private @const {array} */
    this.stimFileClusters_ = this.getStimFileClusters(this.parentStimFileName_, stimJson);

    /** @private {object} **/
    this.orderGroupValuesMap_ = {};

    /** @private {object} */
    this.generatedTdf_ = {
      isMultiTdf: true,
      fileName: fileName,
      ownerId: ownerId,
      source: source,
      tdfs: this.parentTdfJson_,
      subTdfs: [],
    };
  }

  /**
   * Get a TDF with subTDFs generated based on parent TDF criteria
   * @return {object}
   */
  getGeneratedTdf() {
    this.setOrderGroupValuesMap();
    this.parentGeneratedTdfs_.forEach((spec) => {
      const clusterList = this.getBuiltClusterList(spec);

      if (!_.isEmpty(clusterList)) { // Ignore cluster lists where criteria was not met
        this.generatedTdf_.subTdfs.push({
          lessonName: spec.name,
          clusterList: clusterList,
        });
      }
    });
    this.generatedTdf_.createdAt = new Date();
    return this.generatedTdf_;
  }

  /**
   * Creates a cluster list based on tag criteria
   * @param {object} spec
   * @return {array}
   */
  getBuiltClusterList(spec) {
    let clusterListString = '';
    let start = -1;
    let end = -1;
    let last = -1;
    const [weightStart, weightEnd] = this.getWeightValues(spec.criteria[0]) || [-1, -1];
    const orderGroup = this.getOrderGroupValue(spec.criteria[0]) || -1;
    const numStimFileClusters = Object.values(this.stimFileClusters_).length;

    Object.values(this.stimFileClusters_).sort((a, b) => a.clusterKC >= b.clusterKC);

    Object.values(this.stimFileClusters_).forEach((cluster) => {
      const idx = Object.values(cluster)[0].clusterKC % KC_MULTIPLE;
      const allClusterTags = [];
      for (const stim of Object.values(cluster)) {
        if (stim.tags) {
          allClusterTags.push(stim.tags);
        }
      }
      const isIncludedInStimCluster = this.isIncludedCluster(allClusterTags, weightStart, weightEnd, orderGroup);

      if (start === -1 && isIncludedInStimCluster) {
        start = idx;
      } else if (start > -1 && isIncludedInStimCluster) {
        if (idx === numStimFileClusters + 1) { // Numbering of KCs starts at 1
          end = idx;
          clusterListString += ' ' + start + '-' + end + ' ';
        } else if (idx-1 > last) {// We skipped one or more
          end = last;
          clusterListString += ' ' + start + '-' + end + ' ';
          start = idx;
          end = -1;
        }
      } else if (start > -1 && !isIncludedInStimCluster) {
        end = idx - 2; // Numbering of KCs starts at 1 in addition to 0-based indexing
        clusterListString += ' ' + start + '-' + end + ' ';
        start = -1;
        end = -1;
      }
      last = idx;
    });
    clusterListString = clusterListString.trim();
    return clusterListString;
  }

  /**
   * Determine if a cluster is eligible for selection based on weight
   * or order group criteria
   * @param {object} stimTagsList
   * @param {number} weightStart
   * @param {number} weightEnd
   * @param {number} orderGroup
   * @return {boolean} isIncludedStimCluster
   */
  isIncludedCluster(stimTagsList, weightStart, weightEnd, orderGroup) {
    let isIncludedStimCluster = false;
    if (stimTagsList && stimTagsList.length) {
      stimTagsList.forEach((stimTags) => {
        const tagOrderGroupProperty = stimTags.orderGroup[0]||stimTags.orderGroup;
        const tagOrderGroup = this.isValidOrderGroup(tagOrderGroupProperty) ?
          parseInt(tagOrderGroupProperty) : -1;
        const tagWeightGroupProperty = stimTags.weightGroup[0]||stimTags.weightGroup;
        const tagWeightGroup = tagWeightGroupProperty || tagWeightGroupProperty == 0 ?
          parseInt(tagWeightGroupProperty) : -1;
        if (tagOrderGroup > -1) {
          if (tagOrderGroup === orderGroup) {
            isIncludedStimCluster = true;
          }
        }
        if (tagWeightGroup > -1) {
          if (tagWeightGroup >= weightStart &&
            tagWeightGroup <= weightEnd) {
            isIncludedStimCluster = true;
          }
        }
      });
    }
    return isIncludedStimCluster;
  }

  /**
   * Determine if an order group is valid based on the criteria
   * 1. Order group exists in stim object
   * 2. Stim object has at least 6 items in that order group
   * @param {string} orderGroupTag
   * @return {boolean} isValidOrderGroup
   */
  isValidOrderGroup(orderGroupTag) {
    if (!orderGroupTag && orderGroupTag != 0) return false;

    const orderGroup = parseInt(orderGroupTag);
    if (this.orderGroupValuesMap_[orderGroup] &&
      this.orderGroupValuesMap_[orderGroup] > 5) {
      return true;
    }

    return false;
  }

  /**
   * Set a map of all order group value counts
   * This map is used to determine TDF order group validity
   */
  setOrderGroupValuesMap() {
    Object.values(this.stimFileClusters_).forEach((cluster) => {
      const firstStim = Object.values(cluster)[0];
      if (firstStim.tags && firstStim.tags.orderGroup) {
        const orderGroupValueKey = (firstStim.tags.orderGroup[0] || firstStim.tags.orderGroup).toString();
        if (this.orderGroupValuesMap_[orderGroupValueKey]) {
          const orderGroupValueCount = this.orderGroupValuesMap_[orderGroupValueKey];
          this.orderGroupValuesMap_[orderGroupValueKey] = orderGroupValueCount + 1;
        } else {
          this.orderGroupValuesMap_[orderGroupValueKey] = 1;
        }
      }
    });
  }

  /**
   * Returns clusters based on stimulus file name
   * @param {string} stimFileName
   * @param {json} stimJson
   * @return {object} clusters
   */
  getStimFileClusters(stimFileName, stimJson) {
    let clusters = [];
    // try {
    const clusterMap = {};
    for (const stim of stimJson) {// [{},{}]
      const clusterIndex = stim.clusterKC;
      const stimIndex = stim.stimulusKC;
      if (!clusterMap[clusterIndex]) clusterMap[clusterIndex] = {};
      clusterMap[clusterIndex][stimIndex] = stim;
    }
    clusters = clusterMap;
    // // console.log('getStimFileClusters:', clusterMap);
    // } catch (error) {
    //  throw new Error('Unable to find clusters with stim file: ',stimFileName,',',error);
    // }
    return clusters;
  }

  /**
   * Returns starting and ending weight values for cluster criteria test
   * @param {object} criteria
   * @return {array} [weightStart, weightEnd]
   */
  getWeightValues(criteria) {
    let [weightStart, weightEnd] = [-1, -1];
    if (criteria.weights && criteria.weights.length) {
      [weightStart, weightEnd] = this.getSplitWeights(criteria.weights[0]);
    }
    return [weightStart, weightEnd];
  }

  /**
   * Returns the order group value for cluster criteria test
   * @param {object} criteria
   * @return {number} orderGroup
   */
  getOrderGroupValue(criteria) {
    let orderGroup = -1;
    if (criteria.orderGroups && criteria.orderGroups.length) {
      orderGroup = parseInt(criteria.orderGroups[0]);
    }
    return orderGroup;
  }

  /**
   * Helper to parse weight start and end values from a given weight range
   * @param {string} weights
   * @return {array} [weightStart, weightEnd]
   */
  getSplitWeights(weights) {
    let weightStart; let weightEnd;
    if (weights.indexOf('-') !== -1) {
      const weightValues = weights.split('-');
      weightStart = parseInt(weightValues[0]);
      weightEnd = parseInt(weightValues[1]);
    } else {
      weightStart = parseInt(weights[0]);
      weightEnd = weightStart;
    }
    return [weightStart, weightEnd];
  }
}
