function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function declareTutorPropertiesInBranch(
  branch: Record<string, any> | undefined,
  tutorProperties: Record<string, any>
) {
  if (!branch) return;

  const branchProperties = branch.properties || {};
  branch.properties = Object.fromEntries(
    Object.entries(tutorProperties).map(([key, propertySchema]) => [
      key,
      {
        ...propertySchema,
        ...(branchProperties[key] || {})
      }
    ])
  );
}

/**
 * JSON Editor 2.15.2 applies its no-additional-properties option to an active
 * allOf member and conditional branch independently of the enclosing object
 * schema. Declare canonical properties in the condition and its unit-exclusion
 * check too, so strict validation does not change which branch applies.
 */
export function prepareTutorSchemaForJsonEditor(tutorSchema: Record<string, any>) {
  const preparedSchema = clone(tutorSchema || {});
  const tutorProperties = preparedSchema.properties || {};

  for (const conditional of preparedSchema.allOf || []) {
    declareTutorPropertiesInBranch(conditional, tutorProperties);
    declareTutorPropertiesInBranch(conditional.if, tutorProperties);
    declareTutorPropertiesInBranch(conditional.then, tutorProperties);
    declareTutorPropertiesInBranch(conditional.then?.not, tutorProperties);
    declareTutorPropertiesInBranch(conditional.else, tutorProperties);
  }

  return preparedSchema;
}
