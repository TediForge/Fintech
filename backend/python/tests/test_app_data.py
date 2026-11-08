import json
from importlib.resources import files


def _read_data(filename: str):
    return json.loads(files("app.data").joinpath(filename).read_text(encoding="utf-8"))


def test_country_data_matches_node_auth_country_codes() -> None:
    countries = _read_data("countries.json")

    assert set(countries) == {"NG", "GH", "KE"}
    assert countries["NG"] == {
        "countryCode": "NG",
        "countryName": "Nigeria",
        "dialCode": "+234",
    }


def test_gift_card_data_joins_images_and_retains_full_image_map() -> None:
    gift_card_data = _read_data("giftcard.json")

    assert len(gift_card_data["giftCards"]) == 3
    assert len(gift_card_data["images"]) == 12
    apple = gift_card_data["giftCards"][0]
    assert apple["imageId"] == "apple"
    assert apple["image"] == gift_card_data["images"]["apple"]
    assert apple["countries"][0]["countryCode"] == "US"


def test_verification_data_joins_program_ids_to_country_requirements() -> None:
    verify = _read_data("verify.json")

    assert set(verify) == {"NG", "GH", "KE"}
    assert verify["NG"]["programIdentifier"] == "prog_95ae00c3e8219b5bcecbcf71"
    assert "tiers" in verify["NG"]
    assert verify["GH"]["programIdentifier"] == "prog_d78a22184758d834f33ee5da"
    assert "programIdentifier" not in verify["KE"]


def test_beneficiary_data_contains_required_and_identity_keys() -> None:
    beneficiaries = _read_data("beneficiaries.json")

    assert set(beneficiaries) == {"requiredKeys", "identityKeys"}
    assert beneficiaries["requiredKeys"]["transfer"] == [
        "accountNumber",
        "bankCode",
        "bankName",
        "accountName",
    ]
    assert beneficiaries["identityKeys"]["transfer"] == ["accountNumber", "bankCode"]


def test_ledger_data_declares_transaction_metadata_allowlists() -> None:
    ledger = _read_data("ledger.json")

    allowed = ledger["metadataAllowedKeys"]
    assert allowed["airtime"] == ["phoneNumber", "network"]
    assert allowed["data"] == ["phoneNumber", "network", "planName", "planId"]
    assert "external bank transfer" not in allowed
    assert "invoice transfer" not in allowed
    assert allowed["refund"] == ["originalReference", "reason"]


def test_daily_task_config_is_loaded_from_tasks_json() -> None:
    tasks = _read_data("tasks.json")["dailyTasks"]

    assert set(tasks) == {"airtime", "fund", "data_purchase", "electricity"}
    assert tasks["airtime"]["maxStep"] == 2
    assert tasks["fund"]["reward"] == 20
