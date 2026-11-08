import asyncio
from importlib import import_module

import pytest
from fastapi import HTTPException
from starlette.requests import Request

cable = import_module("app.api.v1.bills.ng.cable.routes")
electricity = import_module("app.api.v1.bills.ng.electricity.routes")


def _request() -> Request:
    return Request({"type": "http", "headers": []})


@pytest.mark.parametrize(
    "endpoint,args",
    [
        (cable.list_cable_providers, ()),
        (cable.list_cable_plans, (None,)),
        (cable.validate_cable, ("", "", "", {})),
        (
            cable.buy_cable,
            (cable.CableRequest(serviceCode="x", smartCard="12345", variationCode="x"), _request(), {}),
        ),
        (electricity.list_electricity_providers, ()),
        (electricity.validate_meter, ("", "12345", "prepaid", {})),
        (
            electricity.buy_electricity,
            (
                electricity.ElectricityRequest(
                    serviceCode="x",
                    meterNumber="12345",
                    amount=1,
                ),
                _request(),
                {},
            ),
        ),
    ],
)
def test_fafotech_catalog_dependent_bill_routes_fail_closed(
    endpoint, args: tuple[object, ...]
) -> None:
    with pytest.raises(HTTPException) as error:
        asyncio.run(endpoint(*args))

    assert error.value.status_code == 503
    assert "Fafotech" in error.value.detail
