import { config } from '../../configuration';
import { logLine, random } from '../util/util';

import { AddressStore } from '../entity/address-store';
import { Addresses } from '../entity/addresses';

export function createAddresses(connection, coin, cleanup) {
    const addressStoreRepository = connection.getRepository(AddressStore);
    const addressesRepository = connection.getRepository(Addresses);

    // Deploy contract x amount of times
    const createAddress = async () => {
        let count = await addressStoreRepository.count({ coin_id: coin.id });
        logLine('AVAILABLE:', count, 'MIN:', config.minAddresses);

        if (count >= config.minAddresses) {
            cleanup();
            return;
        }

        logLine('We have', config.minAddresses-count, 'addresses to fill');

        let newAddress = "";
        do {
            newAddress = random(config.addressLength);
        } while (addressesRepository.count({address_address: newAddress}) == 1 || addressStoreRepository.count({address: newAddress}) == 1);

        const addressStore = new AddressStore();

        addressStore.address = newAddress;
        addressStore.coin_id = coin.id;

        await connection.manager.save(addressStore);

        logLine('Storing address', newAddress);

        createAddress();

    };

    createAddress();
}
