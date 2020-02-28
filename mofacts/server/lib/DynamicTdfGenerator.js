export class DynamicTdfGenerator {
  constructor(parentTdfJson, fileName, ownerId, source) {
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
    this.stimFileClusters_ = this.getStimFileClusters(this.fileName_);

    /** @private {object} */
    this.generatedTdf_ = {
      isMultiTdf: true,
      fileName: fileName,
      owner: ownerId,
      source: source,
      tdfs: this.parentTdfJson,
      subtdfs: []
    };
  }

  /**
   * 
   * @return {object}
   */
  getGeneratedTdf() {
    this.parentGeneratedTdfs_.forEach((spec, idx) => {
      
    });

    return this.generatedTdf_;
  }

  /**
   * Evaluates cluster eligibility on criteria and returns an array of cluster
   * lists (array of arrays)
   * @param {object} spec
   * @return {array} 
   */
  getBuiltClusterList(spec) {
    let clusterList = [];
    let [weightStart, weightEnd] = this.getWeightValues(spec.criteria[0]) || [-1, -1];
    let orderGroup = this.getOrderGroupValue = this.getOrderGroupValue || -1;
    let clusterListString = "";
    let start = -1;
    let end = -1;

    this.stimFileClusters_.forEach((cluster, idx) => {
      
    });    


    return clusterList;
  }

  /**
   * 
   * @param {string} stimFileName 
   */
  getStimFileClusters(stimFileName) {
    let clusters = [];

    try {
      clusters = Stimuli.findOne({fileName: stimFileName});
    } catch (error) {
      throw new Error('Unable to fine clusters with stim file: ' 
        + stimFileName);
    }

    return clusters;
  }

  /**
   * 
   * @param {object} spec
   * @return {array} 
   */
  getWeightValues(criteria) {
    let [weightStart, weightEnd, orderGroup] = [-1, -1, -1];

    if (criteria.weights && criteria.weights.length) {
      [weightStart, weightEnd] = this.getSplitWeights(criteria.weights[0]);
    }

    return [weightStart, weightEnd];
  }

  getOrderGroupValue(criteria) {
    if (criteria.orderGroups && criteria.orderGroups.length) {
      orderGroup = parseInt(criteria.orderGroups[0]);
    }
  }

  getSplitWeights(weights) {
    let weightStart, weightEnd;
    let weightValues = weights.split('-');

    if (weightValues.indexOf('-') !== -1) {
      weightStart = parseInt(weightValues[0]);
      weightEnd = parseInt(weightValues[1]);
    } else {
      weightStart = parseInt(weightValues);
      weightEnd = weightStart;
    }

    return [weightStart, weightEnd];
  }
}