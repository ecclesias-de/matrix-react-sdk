/*
Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { MatrixClient } from "matrix-js-sdk/src/matrix";

import { getE2EEWellKnown } from "../WellKnownUtils";

/**
 * Returns true when .well-known e2ee config disable_setup is TRUE
 * When true cross signing and backups should not be setup by default.
 *
 * @param client
 * @returns whether well-known config forces encryption to DISABLED
 */
export function shouldDisableSetupEncryption(client: MatrixClient): boolean {
    const e2eeWellKnown = getE2EEWellKnown(client);

    if (e2eeWellKnown) {
        const shouldDisableSetup = e2eeWellKnown["disable_setup"] === true;
        return shouldDisableSetup;
    }
    return false;
}
