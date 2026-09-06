import { expect } from 'chai';
import { prepareTutorSchemaForJsonEditor } from './tdfDraftSchema';

describe('prepareTutorSchemaForJsonEditor', function() {
  it('declares canonical tutor properties in conditional branches without weakening branch rules', function() {
    const schema = {
      type: 'object',
      required: ['setspec'],
      properties: {
        setspec: { type: 'object' },
        unit: { type: 'array', items: { type: 'object' } },
        deliverySettings: { type: 'object' }
      },
      allOf: [{
        if: { properties: { setspec: { required: ['condition'] } } },
        then: { not: { required: ['unit'] } },
        else: { properties: { unit: { minItems: 1 } } }
      }]
    };

    const prepared = prepareTutorSchemaForJsonEditor(schema);
    const conditional = prepared.allOf[0];

    expect(Object.keys(conditional.then.properties)).to.have.members([
      'setspec',
      'unit',
      'deliverySettings'
    ]);
    expect(Object.keys(conditional.else.properties)).to.have.members([
      'setspec',
      'unit',
      'deliverySettings'
    ]);
    expect(conditional.then.not).to.deep.equal({ required: ['unit'] });
    expect(conditional.else.properties.unit).to.deep.equal({
      type: 'array',
      items: { type: 'object' },
      minItems: 1
    });
    expect(prepared.required).to.deep.equal(['setspec']);
    expect(schema.allOf[0]?.then).not.to.have.property('properties');
  });
});
