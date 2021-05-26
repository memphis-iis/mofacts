import { KC_MULTIPLE } from "./Definitions";

export class DynamicTdfGenerator {
  constructor(parentTdfJson, fileName, ownerId, source, stimJson) {
    /** @private {object} */
    this.parentTdfJson_ = parentTdfJson;

    /** @private @const {object} */
    this.parentTutor_ = this.parentTdfJson_.tutor;

    /** @private @const {array} */
    this.parentSetSpec_ = this.parentTutor_.setspec[0];

    /** @private @const {array} */
    this.parentUnits_ = this.parentTutor_.unit;

    /** @private @const {array} */
    this.parentGeneratedTdfs_ = this.parentTutor_.generatedtdfs[0].generatedtdf;

    /** @private @const {string} */
    this.parentStimFileName_ = this.parentSetSpec_.stimulusfile[0];

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
      subTdfs: []
    };
  }

  /**
   * Get a TDF with subTDFs generated based on parent TDF criteria
   * @returns {object}
   */
  getGeneratedTdf() {
    this.setOrderGroupValuesMap();
    this.parentGeneratedTdfs_.forEach(spec => {
      let clusterList = this.getBuiltClusterList(spec)

      if (!_.isEmpty(clusterList)) { // Ignore cluster lists where criteria was not met
        this.generatedTdf_.subTdfs.push({
          lessonName: spec.name,
          clusterList: clusterList
        })
      }
    });
    this.generatedTdf_.createdAt = new Date();
    return this.generatedTdf_;
  }

  /**
   * Creates a cluster list based on tag criteria
   * @param {object} spec
   * @returns {array} 
   */
  getBuiltClusterList(spec) {
    let clusterListString = '';
    let start = -1;
    let end = -1;
    let [weightStart, weightEnd] = this.getWeightValues(spec.criteria[0]) || [-1, -1];
    let orderGroup = this.getOrderGroupValue(spec.criteria[0]) || -1;

    Object.values(this.stimFileClusters_).forEach(cluster => {
      let idx = Object.values(cluster)[0].clusterKC % KC_MULTIPLE;
      let allClusterTags = [];
      for(let stim of Object.values(cluster)){
        if(stim.tags){
          allClusterTags.push(stim.tags);
        }
      }
      let isIncludedInStimCluster = this.isIncludedCluster(allClusterTags, weightStart, weightEnd, orderGroup);
      
      if (start === -1 && isIncludedInStimCluster) {
        start = idx;
      } else if (start > -1 && isIncludedInStimCluster) {
        if (idx === Object.keys(this.stimFileClusters_).length - 1) {
          end = idx;
          clusterListString += ' ' + start + '-' + end + ' ';
        }
      } else if (start > -1 && !isIncludedInStimCluster) {
        end = idx - 1;
        clusterListString += ' ' + start + '-' + end + ' ';
        start = -1;
        end = -1; 
      }
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
   * @returns {boolean} isIncludedStimCluster
   */
  isIncludedCluster(stimTagsList, weightStart, weightEnd, orderGroup) {
    let isIncludedStimCluster = false;
    if (stimTagsList && stimTagsList.length) {
      stimTagsList.forEach(stimTags => {
        let tagOrderGroupProperty = stimTags.orderGroup[0]||stimTags.orderGroup;
        let tagOrderGroup = this.isValidOrderGroup(tagOrderGroupProperty) 
          ? parseInt(tagOrderGroupProperty) : -1;
        let tagWeightGroupProperty = stimTags.weightGroup[0]||stimTags.weightGroup;
        let tagWeightGroup = tagWeightGroupProperty || tagWeightGroupProperty == 0
          ? parseInt(tagWeightGroupProperty) : -1;
        if (tagOrderGroup > -1) {
          if (tagOrderGroup === orderGroup) {
            isIncludedStimCluster = true;
          }
        }
        if (tagWeightGroup > -1) {
          if (tagWeightGroup >= weightStart 
            && tagWeightGroup <= weightEnd) {
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
   * @param {boolean}
   */
  isValidOrderGroup(orderGroupTag) {
    if (!orderGroupTag && orderGroupTag != 0) return false;

    let orderGroup = parseInt(orderGroupTag);
    if (this.orderGroupValuesMap_[orderGroup] 
      && this.orderGroupValuesMap_[orderGroup] > 5) {
      return true;
    }

    return false;
  }

  /**
   * Set a map of all order group value counts
   * This map is used to determine TDF order group validity 
   */
  setOrderGroupValuesMap() {
    Object.values(this.stimFileClusters_).forEach(cluster => {
      let firstStim = Object.values(cluster)[0];
      if (firstStim.tags && firstStim.tags.orderGroup) {
        let orderGroupValueKey = (firstStim.tags.orderGroup[0] || firstStim.tags.orderGroup).toString();
        if (this.orderGroupValuesMap_[orderGroupValueKey]) {
          let orderGroupValueCount = this.orderGroupValuesMap_[orderGroupValueKey];
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
   * @returns {object} clusters 
   */
  getStimFileClusters(stimFileName, stimJson) {
    let clusters = [];
    // try { 
      let clusterMap = [];
      console.log("!!!getStimFileClusters:",stimJson);
      for(let stim of stimJson){//[{},{}]
        let clusterIndex = stim.clusterKC;
        let stimIndex = stim.stimulusKC;
        if(!clusterMap[clusterIndex]) clusterMap[clusterIndex] = [];
        clusterMap[clusterIndex][stimIndex] = stim;
      }
      clusters = clusterMap;
    // } catch (error) {
    //  throw new Error('Unable to find clusters with stim file: ',stimFileName,',',error);
    // }
    return clusters;
  }

  /**
   * Returns starting and ending weight values for cluster criteria test
   * @param {object} spec
   * @returns {array} [weightStart, weightEnd]
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
   * @returns {number} orderGroup 
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
   * @returns {array} [weightStart, weightEnd] 
   */
  getSplitWeights(weights) {
    let weightStart, weightEnd;
    if (weights.indexOf('-') !== -1) {
      let weightValues = weights.split('-');
      weightStart = parseInt(weightValues[0]);
      weightEnd = parseInt(weightValues[1]);
    } else {
      weightStart = parseInt(weights[0]);
      weightEnd = weightStart;
    }
    return [weightStart, weightEnd];
  }
}