# Approved body to Fusion

Run this workflow only after the user requests a transfer in chat. Approval in the viewer stores a version but does not launch Fusion.

1. Identify the project and approved version the user means. Fetch `/api/projects/ID/versions`; compare its parameters with the request. If no approved version exists, have the user approve the intended draft before a production transfer.
2. Fetch `/api/projects/ID/handoff?version=UUID`. Preserve versionId and hash. The response contains resolved millimetre geometry and a Fusion Python script generated from this snapshot, never from the mutable draft.
3. Use the installed Fusion CAD skill and an available Fusion connection. Run the script in Fusion. It creates a new direct-design document and combines the primitives into one solid; it does not modify an existing model. The coordinate conversion is web (X,Y,Z) to Fusion (X,-Z,Y), and millimetres to centimetres.
4. Inspect the returned body count, bounds and volume. Require exactly one solid and bounds matching the snapshot within 0.01 mm. Independently verify hole dimensions and volume for the intended design. For disjoint or invalid geometry, stop and correct the draft, then obtain a new approval; never change the selected snapshot to make the transfer succeed.
5. Save the new document to the intended Fusion project. Verify the actual saved file name, project and version from Fusion. Until saving is verified, the transfer remains incomplete.
6. POST `/api/projects/ID/transfers` with `{versionId,hash,destination,verified:true}` only after successful verification. Include the Fusion project, document and saved version in destination. The receipt records what the agent verified; the website cannot independently inspect Fusion.
7. Report the saved destination and source version to the user. On connection failure, keep the approved version available and report the failed stage without recording success.

The script transfers a solid body without editable sketch history. It is not an STL export. The website has no automatic access to Fusion and no embedded agent chat.
