/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/vault_inheritance.json`.
 */
export type VaultInheritance = {
  "address": "6sgj9jnnFcYem1u3N4wCfMdtTeeQRf7uT2AGWRU5EhtY",
  "metadata": {
    "name": "vaultInheritance",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "docs": [
    "# vault-inheritance",
    "",
    "A non-custodial digital-will / dead-man's-switch program.",
    "",
    "## Lifecycle",
    "1. **Create** — `initialise_will` sets the inactivity threshold (dead-man's",
    "switch window) and the number of custodian approvals required.",
    "2. **Configure** — while `Active`, the owner adds/removes media references",
    "(IPFS CIDs of client-encrypted files), custodians (who can confirm death),",
    "beneficiaries (heirs, with basis-point shares) and escrowed SPL tokens.",
    "Heirs register their own `encryption_pubkey` so the owner can seal each",
    "document's data key to them.",
    "3. **Ping** — `update_will` refreshes the liveness timer (and can re-tune the",
    "threshold / approvals). Each ping proves the owner is alive.",
    "4. **Confirm death** — once the owner has been silent past the threshold,",
    "custodians call `confirm_death`. At quorum the will becomes `Claimable`",
    "and `claimable_at` starts the clock.",
    "5. **Grace period** — for `GRACE_PERIOD_SECONDS` nothing may be claimed and a",
    "living owner may `revoke_death_confirmation`, returning the will to",
    "`Active` and invalidating every confirmation cast so far.",
    "6. **Claim** — once grace expires, beneficiaries call `claim_inheritance`",
    "(unlocking their document keys) and `claim_token` (their proportional",
    "share of each escrowed mint).",
    "7. **Teardown** — after `CLAIM_WINDOW_SECONDS` the permissionless",
    "`sweep_token_vault` + `cleanup_*` + `close_will` cranks return every",
    "residual token and all rent to the estate.",
    "",
    "## Timing invariants that make this safe",
    "* Nothing is claimable before `claimable_at + GRACE_PERIOD_SECONDS` — a",
    "mistaken or malicious death confirmation can never move an asset before the",
    "owner has had the chance to undo it.",
    "* No teardown crank may run before `claimable_at + GRACE + CLAIM_WINDOW` — a",
    "stranger can never close an heir's account out from under a pending claim.",
    "* No asset may enter a will whose quorum is unreachable",
    "(`min_approvals <= custodian_count`), so an estate can never be locked away",
    "from the heirs it names.",
    "* A will can never be closed while it still owns a token vault, because the",
    "will PDA is the vault's only possible authority.",
    "",
    "## Confidentiality",
    "Media bytes are encrypted in the owner's browser (AES-256-GCM) before upload;",
    "the per-file data key is wrapped to the owner and to each heir's registered",
    "X25519 key. The chain stores only the CID, so publishing it reveals the",
    "existence of a document and nothing more. The program is never trusted with",
    "plaintext or with a decryption key."
  ],
  "instructions": [
    {
      "name": "addBeneficiary",
      "discriminator": [
        105,
        214,
        106,
        141,
        180,
        166,
        123,
        238
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true,
          "relations": [
            "will"
          ]
        },
        {
          "name": "will",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  119,
                  105,
                  108,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "beneficiary",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  101,
                  110,
                  101,
                  102,
                  105,
                  99,
                  105,
                  97,
                  114,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "will"
              },
              {
                "kind": "account",
                "path": "walletKey"
              }
            ]
          }
        },
        {
          "name": "walletKey"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "allocationPercentage",
          "type": "u16"
        }
      ]
    },
    {
      "name": "addCustodian",
      "discriminator": [
        173,
        133,
        165,
        124,
        100,
        133,
        110,
        203
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true,
          "relations": [
            "will"
          ]
        },
        {
          "name": "will",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  119,
                  105,
                  108,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "custodian",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  117,
                  115,
                  116,
                  111,
                  100,
                  105,
                  97,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "will"
              },
              {
                "kind": "account",
                "path": "walletKey"
              }
            ]
          }
        },
        {
          "name": "walletKey"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "addMediaReference",
      "discriminator": [
        160,
        100,
        54,
        176,
        68,
        17,
        45,
        225
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true,
          "relations": [
            "will"
          ]
        },
        {
          "name": "will",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  119,
                  105,
                  108,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "mediaReference",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  101,
                  100,
                  105,
                  97,
                  114,
                  101,
                  102,
                  101,
                  114,
                  101,
                  110,
                  99,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "will"
              },
              {
                "kind": "account",
                "path": "will.mediaIndex",
                "account": "will"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "mediaType",
          "type": {
            "array": [
              "u8",
              16
            ]
          }
        },
        {
          "name": "ipfsCid",
          "type": {
            "array": [
              "u8",
              64
            ]
          }
        }
      ]
    },
    {
      "name": "addToken",
      "discriminator": [
        237,
        255,
        26,
        54,
        56,
        48,
        68,
        52
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true,
          "relations": [
            "will"
          ]
        },
        {
          "name": "will",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  119,
                  105,
                  108,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "tokenMint"
        },
        {
          "name": "tokenVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  111,
                  107,
                  101,
                  110,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "will"
              },
              {
                "kind": "account",
                "path": "tokenMint"
              }
            ]
          }
        },
        {
          "name": "ata",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "owner"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "tokenMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "will"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "tokenMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "claimInheritance",
      "discriminator": [
        250,
        34,
        9,
        63,
        155,
        43,
        165,
        249
      ],
      "accounts": [
        {
          "name": "beneficiarySigner",
          "signer": true
        },
        {
          "name": "will",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  119,
                  105,
                  108,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "will.owner",
                "account": "will"
              }
            ]
          },
          "relations": [
            "beneficiary"
          ]
        },
        {
          "name": "beneficiary",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  101,
                  110,
                  101,
                  102,
                  105,
                  99,
                  105,
                  97,
                  114,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "will"
              },
              {
                "kind": "account",
                "path": "beneficiarySigner"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "claimToken",
      "docs": [
        "Beneficiary-only: claim this heir's proportional share of an escrowed",
        "token once the will is Claimable and the grace period has elapsed."
      ],
      "discriminator": [
        116,
        206,
        27,
        191,
        166,
        19,
        0,
        73
      ],
      "accounts": [
        {
          "name": "beneficiarySigner",
          "writable": true,
          "signer": true
        },
        {
          "name": "will",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  119,
                  105,
                  108,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "will.owner",
                "account": "will"
              }
            ]
          },
          "relations": [
            "beneficiary",
            "tokenVault"
          ]
        },
        {
          "name": "beneficiary",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  101,
                  110,
                  101,
                  102,
                  105,
                  99,
                  105,
                  97,
                  114,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "will"
              },
              {
                "kind": "account",
                "path": "beneficiarySigner"
              }
            ]
          }
        },
        {
          "name": "tokenVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  111,
                  107,
                  101,
                  110,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "will"
              },
              {
                "kind": "account",
                "path": "tokenMint"
              }
            ]
          }
        },
        {
          "name": "tokenMint",
          "relations": [
            "tokenVault"
          ]
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "will"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "tokenMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "beneficiaryAta",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "beneficiarySigner"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "tokenMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenClaim",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  111,
                  107,
                  101,
                  110,
                  99,
                  108,
                  97,
                  105,
                  109
                ]
              },
              {
                "kind": "account",
                "path": "tokenVault"
              },
              {
                "kind": "account",
                "path": "beneficiarySigner"
              }
            ]
          }
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "cleanupBeneficiary",
      "discriminator": [
        52,
        26,
        102,
        243,
        36,
        90,
        120,
        130
      ],
      "accounts": [
        {
          "name": "cranker",
          "writable": true,
          "signer": true
        },
        {
          "name": "owner",
          "writable": true
        },
        {
          "name": "will",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  119,
                  105,
                  108,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "will.owner",
                "account": "will"
              }
            ]
          },
          "relations": [
            "beneficiary"
          ]
        },
        {
          "name": "beneficiary",
          "writable": true
        }
      ],
      "args": []
    },
    {
      "name": "cleanupCustodian",
      "discriminator": [
        11,
        199,
        210,
        47,
        16,
        8,
        4,
        183
      ],
      "accounts": [
        {
          "name": "cranker",
          "docs": [
            "Pays the transaction fee; receives nothing else."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "owner",
          "docs": [
            "cannot be redirected; receives the closed account's lamports."
          ],
          "writable": true
        },
        {
          "name": "will",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  119,
                  105,
                  108,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "will.owner",
                "account": "will"
              }
            ]
          },
          "relations": [
            "custodian"
          ]
        },
        {
          "name": "custodian",
          "writable": true
        }
      ],
      "args": []
    },
    {
      "name": "cleanupMedia",
      "discriminator": [
        132,
        237,
        87,
        225,
        199,
        251,
        130,
        81
      ],
      "accounts": [
        {
          "name": "cranker",
          "writable": true,
          "signer": true
        },
        {
          "name": "owner",
          "writable": true
        },
        {
          "name": "will",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  119,
                  105,
                  108,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "will.owner",
                "account": "will"
              }
            ]
          },
          "relations": [
            "mediaReference"
          ]
        },
        {
          "name": "mediaReference",
          "writable": true
        }
      ],
      "args": []
    },
    {
      "name": "closeWill",
      "discriminator": [
        45,
        211,
        135,
        172,
        40,
        251,
        152,
        102
      ],
      "accounts": [
        {
          "name": "cranker",
          "writable": true,
          "signer": true
        },
        {
          "name": "owner",
          "writable": true
        },
        {
          "name": "will",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  119,
                  105,
                  108,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "will.owner",
                "account": "will"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "confirmDeath",
      "discriminator": [
        65,
        107,
        205,
        58,
        183,
        104,
        41,
        43
      ],
      "accounts": [
        {
          "name": "custodianSigner",
          "signer": true
        },
        {
          "name": "will",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  119,
                  105,
                  108,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "will.owner",
                "account": "will"
              }
            ]
          },
          "relations": [
            "custodian"
          ]
        },
        {
          "name": "custodian",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  117,
                  115,
                  116,
                  111,
                  100,
                  105,
                  97,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "will"
              },
              {
                "kind": "account",
                "path": "custodianSigner"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "deleteToken",
      "discriminator": [
        208,
        193,
        211,
        235,
        81,
        190,
        115,
        68
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true,
          "relations": [
            "will"
          ]
        },
        {
          "name": "will",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  119,
                  105,
                  108,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          },
          "relations": [
            "tokenVault"
          ]
        },
        {
          "name": "tokenMint",
          "relations": [
            "tokenVault"
          ]
        },
        {
          "name": "tokenVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  111,
                  107,
                  101,
                  110,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "will"
              },
              {
                "kind": "account",
                "path": "tokenMint"
              }
            ]
          }
        },
        {
          "name": "ata",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "owner"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "tokenMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "will"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "tokenMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "deleteWill",
      "discriminator": [
        65,
        64,
        104,
        174,
        54,
        87,
        223,
        9
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true,
          "relations": [
            "will"
          ]
        },
        {
          "name": "will",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  119,
                  105,
                  108,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "initialiseWill",
      "discriminator": [
        77,
        33,
        114,
        251,
        47,
        40,
        141,
        215
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "will",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  119,
                  105,
                  108,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "inactivityThreshold",
          "type": "i64"
        },
        {
          "name": "minApproval",
          "type": "u8"
        }
      ]
    },
    {
      "name": "registerRecipientKey",
      "docs": [
        "Beneficiary-only: publish the X25519 public key that document data keys",
        "are sealed to. Without this the owner cannot share encrypted media."
      ],
      "discriminator": [
        224,
        115,
        239,
        13,
        19,
        174,
        184,
        51
      ],
      "accounts": [
        {
          "name": "beneficiarySigner",
          "writable": true,
          "signer": true
        },
        {
          "name": "will",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  119,
                  105,
                  108,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "will.owner",
                "account": "will"
              }
            ]
          },
          "relations": [
            "beneficiary"
          ]
        },
        {
          "name": "beneficiary",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  101,
                  110,
                  101,
                  102,
                  105,
                  99,
                  105,
                  97,
                  114,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "will"
              },
              {
                "kind": "account",
                "path": "beneficiarySigner"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "encryptionPubkey",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "removeBeneficiary",
      "discriminator": [
        67,
        27,
        24,
        153,
        135,
        64,
        202,
        77
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true,
          "relations": [
            "will"
          ]
        },
        {
          "name": "will",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  119,
                  105,
                  108,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          },
          "relations": [
            "beneficiary"
          ]
        },
        {
          "name": "beneficiary",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  101,
                  110,
                  101,
                  102,
                  105,
                  99,
                  105,
                  97,
                  114,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "will"
              },
              {
                "kind": "account",
                "path": "walletKey"
              }
            ]
          }
        },
        {
          "name": "walletKey"
        }
      ],
      "args": []
    },
    {
      "name": "removeCustodian",
      "discriminator": [
        249,
        107,
        34,
        152,
        33,
        98,
        180,
        14
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true,
          "relations": [
            "will"
          ]
        },
        {
          "name": "will",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  119,
                  105,
                  108,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          },
          "relations": [
            "custodian"
          ]
        },
        {
          "name": "custodian",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  117,
                  115,
                  116,
                  111,
                  100,
                  105,
                  97,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "will"
              },
              {
                "kind": "account",
                "path": "walletKey"
              }
            ]
          }
        },
        {
          "name": "walletKey"
        }
      ],
      "args": []
    },
    {
      "name": "removeMediaReference",
      "discriminator": [
        114,
        111,
        76,
        59,
        237,
        109,
        12,
        128
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true,
          "relations": [
            "will"
          ]
        },
        {
          "name": "will",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  119,
                  105,
                  108,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          },
          "relations": [
            "mediaReference"
          ]
        },
        {
          "name": "mediaReference",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  101,
                  100,
                  105,
                  97,
                  114,
                  101,
                  102,
                  101,
                  114,
                  101,
                  110,
                  99,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "will"
              },
              {
                "kind": "arg",
                "path": "mediaIndex"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "mediaIndex",
          "type": "u16"
        }
      ]
    },
    {
      "name": "revokeDeathConfirmation",
      "docs": [
        "Owner-only escape hatch: cancel an in-flight death confirmation while the",
        "grace period is still running and return the will to `Active`."
      ],
      "discriminator": [
        209,
        92,
        115,
        118,
        173,
        209,
        165,
        175
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true,
          "relations": [
            "will"
          ]
        },
        {
          "name": "will",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  119,
                  105,
                  108,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "sweepTokenVault",
      "docs": [
        "Return every residual token (unallocated remainder, rounding dust, and",
        "unclaimed shares) to the estate and close the vault. Only after the",
        "heirs' claim window has closed."
      ],
      "discriminator": [
        195,
        193,
        130,
        78,
        49,
        96,
        197,
        89
      ],
      "accounts": [
        {
          "name": "cranker",
          "docs": [
            "Pays the transaction fee and the owner ATA rent if one must be created."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "owner",
          "docs": [
            "residual balance and rent cannot be redirected to the caller."
          ],
          "writable": true
        },
        {
          "name": "will",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  119,
                  105,
                  108,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "will.owner",
                "account": "will"
              }
            ]
          },
          "relations": [
            "tokenVault"
          ]
        },
        {
          "name": "tokenMint",
          "relations": [
            "tokenVault"
          ]
        },
        {
          "name": "tokenVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  111,
                  107,
                  101,
                  110,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "will"
              },
              {
                "kind": "account",
                "path": "tokenMint"
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "will"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "tokenMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "ownerAta",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "owner"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "tokenMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "updateWill",
      "discriminator": [
        192,
        206,
        217,
        54,
        165,
        122,
        8,
        10
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true,
          "relations": [
            "will"
          ]
        },
        {
          "name": "will",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  119,
                  105,
                  108,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "inactivityThreshold",
          "type": {
            "option": "i64"
          }
        },
        {
          "name": "minApproval",
          "type": {
            "option": "u8"
          }
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "beneficiary",
      "discriminator": [
        45,
        182,
        224,
        198,
        197,
        255,
        233,
        33
      ]
    },
    {
      "name": "custodian",
      "discriminator": [
        132,
        228,
        139,
        184,
        112,
        228,
        108,
        240
      ]
    },
    {
      "name": "mediaReference",
      "discriminator": [
        230,
        181,
        226,
        75,
        118,
        84,
        109,
        230
      ]
    },
    {
      "name": "tokenClaim",
      "discriminator": [
        82,
        62,
        210,
        197,
        254,
        152,
        116,
        18
      ]
    },
    {
      "name": "tokenVault",
      "discriminator": [
        121,
        7,
        84,
        254,
        151,
        228,
        43,
        144
      ]
    },
    {
      "name": "will",
      "discriminator": [
        118,
        59,
        220,
        69,
        27,
        104,
        241,
        81
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "customError",
      "msg": "Custom error message"
    },
    {
      "code": 6001,
      "name": "mathOverflow",
      "msg": "A mathematical overflow or underflow occurred."
    },
    {
      "code": 6002,
      "name": "willNotActive",
      "msg": "The will should be active, the current will is not active"
    },
    {
      "code": 6003,
      "name": "invalidStatusTransition",
      "msg": "Invalid state transition for the digital will."
    },
    {
      "code": 6004,
      "name": "mediaCountIsZero",
      "msg": "Media count is zero for current will"
    },
    {
      "code": 6005,
      "name": "unableToDeleteWill",
      "msg": "Will is PendingInheritance, Claimable, or Closed; it cannot be deleted now."
    },
    {
      "code": 6006,
      "name": "willHasDependents",
      "msg": "The will still has media, custodians, or beneficiaries; remove them before deleting."
    },
    {
      "code": 6007,
      "name": "willNotClaimable",
      "msg": "The will is not in a Claimable state."
    },
    {
      "code": 6008,
      "name": "allocationExceeded",
      "msg": "Total beneficiary allocation would exceed 100%."
    },
    {
      "code": 6009,
      "name": "invalidThreshold",
      "msg": "Inactivity threshold must be greater than zero seconds."
    },
    {
      "code": 6010,
      "name": "invalidMinApproval",
      "msg": "Minimum approvals must be at least 1."
    },
    {
      "code": 6011,
      "name": "minApprovalsExceedCustodians",
      "msg": "Minimum approvals cannot exceed the number of custodians."
    },
    {
      "code": 6012,
      "name": "ownerStillActive",
      "msg": "The owner is still active; the inactivity window has not elapsed yet."
    },
    {
      "code": 6013,
      "name": "noCustodianFoundDeleteError",
      "msg": "No Custodian is available to delete"
    },
    {
      "code": 6014,
      "name": "alreadyApproved",
      "msg": "This custodian has already confirmed the owner's death."
    },
    {
      "code": 6015,
      "name": "noCustodians",
      "msg": "The will has no custodians; at least one custodian is required."
    },
    {
      "code": 6016,
      "name": "noBeneficiaryFoundDeleteError",
      "msg": "No beneficiary is available to delete"
    },
    {
      "code": 6017,
      "name": "alreadyClaimed",
      "msg": "This beneficiary has already claimed the inheritance."
    },
    {
      "code": 6018,
      "name": "estateNotEmpty",
      "msg": "The will still has children; reclaim them before closing the estate."
    },
    {
      "code": 6019,
      "name": "invalidAmount",
      "msg": "Invalid amount for token transfer"
    },
    {
      "code": 6020,
      "name": "nothingToClaim",
      "msg": "This beneficiary has no allocation or there are no tokens left to claim."
    },
    {
      "code": 6021,
      "name": "deprecatedVaultMigration",
      "msg": "Deprecated error code; no longer raised by this program."
    },
    {
      "code": 6022,
      "name": "gracePeriodNotElapsed",
      "msg": "The grace period has not elapsed yet; claims are not open."
    },
    {
      "code": 6023,
      "name": "claimWindowStillOpen",
      "msg": "The heirs' claim window is still open; teardown cannot start yet."
    },
    {
      "code": 6024,
      "name": "nothingToRevoke",
      "msg": "There is no revocable death confirmation, or the grace period has expired."
    },
    {
      "code": 6025,
      "name": "quorumUnreachable",
      "msg": "Quorum is unreachable: add custodians or lower the required approvals first."
    },
    {
      "code": 6026,
      "name": "willHasTokenVaults",
      "msg": "The will still holds token vaults; sweep them before closing the estate."
    },
    {
      "code": 6027,
      "name": "noEncryptionKey",
      "msg": "This beneficiary has not registered an encryption key."
    }
  ],
  "types": [
    {
      "name": "beneficiary",
      "docs": [
        "A beneficiary inherits a share of the estate. `allocation_percentage` is the",
        "share in basis points; `has_claimed` records acceptance of the media estate."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "will",
            "docs": [
              "Back-reference to the parent will (validated with `has_one = will`)."
            ],
            "type": "pubkey"
          },
          {
            "name": "wallet",
            "docs": [
              "The beneficiary's wallet; also part of this account's PDA seed."
            ],
            "type": "pubkey"
          },
          {
            "name": "allocationPercentage",
            "docs": [
              "Share of the estate in basis points, 0..=10000."
            ],
            "type": "u16"
          },
          {
            "name": "hasClaimed",
            "docs": [
              "Whether this beneficiary has accepted their inheritance. Blocks double-claim."
            ],
            "type": "bool"
          },
          {
            "name": "encryptionPubkey",
            "docs": [
              "X25519 public key this heir published for key agreement, or all-zero if",
              "they have not registered one yet (C5). The owner wraps each document's",
              "data key to this key, so the ciphertext on IPFS can only be opened by the",
              "matching secret — which never leaves the heir's browser. Registered by",
              "the beneficiary themselves via `register_recipient_key`."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "custodian",
      "docs": [
        "A custodian is a trusted party who can confirm the owner's death. Death is",
        "only actionable once `min_approvals` distinct custodians confirm AND the",
        "owner has been inactive past `inactivity_threshold`."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "will",
            "docs": [
              "Back-reference to the parent will (validated with `has_one = will`)."
            ],
            "type": "pubkey"
          },
          {
            "name": "wallet",
            "docs": [
              "The custodian's signing wallet; also part of this account's PDA seed."
            ],
            "type": "pubkey"
          },
          {
            "name": "lastApprovedTime",
            "docs": [
              "Unix timestamp of this custodian's confirmation (0 if not yet approved)."
            ],
            "type": "i64"
          },
          {
            "name": "hasApproved",
            "docs": [
              "Whether this custodian has confirmed death. Only meaningful together with",
              "`approved_epoch` — see `is_current_approval`."
            ],
            "type": "bool"
          },
          {
            "name": "approvedEpoch",
            "docs": [
              "The `Will::approval_epoch` this confirmation was cast in. A confirmation",
              "from a superseded epoch (i.e. one the owner revoked) does not count."
            ],
            "type": "u16"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "mediaReference",
      "docs": [
        "An off-chain media object (document, image, video, ...) referenced by its",
        "IPFS content identifier.",
        "",
        "The bytes on IPFS are AES-256-GCM ciphertext produced in the owner's browser",
        "(C5); the per-file data key is wrapped separately to the owner and to each",
        "registered beneficiary. Publishing the CID on-chain therefore reveals only",
        "that a document exists, never its contents."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "will",
            "docs": [
              "Back-reference to the parent will (validated with `has_one = will`)."
            ],
            "type": "pubkey"
          },
          {
            "name": "mediaIndex",
            "docs": [
              "Monotonic index baked into this account's PDA seed (see `Will::media_index`)."
            ],
            "type": "u16"
          },
          {
            "name": "mediaType",
            "docs": [
              "MIME type, e.g. \"application/pdf\", \"image/png\", \"video/mp4\". Fixed 16",
              "bytes, right-padded with zeros by the client."
            ],
            "type": {
              "array": [
                "u8",
                16
              ]
            }
          },
          {
            "name": "ipfsCid",
            "docs": [
              "IPFS CID, zero-padded. 64 bytes accommodates both CIDv0 (46-char base58,",
              "`Qm...`) and CIDv1 (59-char base32, `bafy...`)."
            ],
            "type": {
              "array": [
                "u8",
                64
              ]
            }
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "tokenClaim",
      "docs": [
        "Per-(token vault, beneficiary) claim marker. Created with `init` inside",
        "`claim_token`, so its existence is itself the double-claim guard: a second",
        "claim of the same token by the same heir fails because the PDA already exists."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "tokenVault",
            "type": "pubkey"
          },
          {
            "name": "beneficiary",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "docs": [
              "Amount actually transferred to the beneficiary (raw base units)."
            ],
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "tokenVault",
      "docs": [
        "Metadata for a single escrowed SPL token. The tokens themselves live in the",
        "`vault` associated-token account (authority = the will PDA); this account only",
        "records the pointers plus `total_amount`."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "will",
            "type": "pubkey"
          },
          {
            "name": "tokenMint",
            "type": "pubkey"
          },
          {
            "name": "ata",
            "type": "pubkey"
          },
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "totalAmount",
            "docs": [
              "Cumulative amount ever escrowed for this mint (raw base units). Each",
              "beneficiary's claimable share is `total_amount * allocation_bps / 10_000`.",
              "Snapshotting the total (rather than reading the live `vault` balance)",
              "keeps every heir's share fixed even as earlier heirs drain the vault."
            ],
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "will",
      "docs": [
        "The root account of a single user's digital will / inheritance vault.",
        "",
        "One `Will` exists per owner: its PDA is derived from `[WILL_SEED, owner]`,",
        "so an owner can hold at most one will at a time. All other accounts",
        "(custodians, beneficiaries, media references, token vaults) are children",
        "whose PDAs are seeded by this will's key.",
        "",
        "SCOPE: the will escrows SPL tokens (see `TokenVault`) and stores pointers to",
        "off-chain media (see `MediaReference`). Media bytes are encrypted client-side",
        "before they ever leave the owner's browser; the chain stores only the CID."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "docs": [
              "The will's creator and sole administrator. Enforced via `has_one = owner`",
              "on every owner-only instruction."
            ],
            "type": "pubkey"
          },
          {
            "name": "willStatus",
            "type": {
              "defined": {
                "name": "willStatus"
              }
            }
          },
          {
            "name": "createdAt",
            "docs": [
              "When the will was first created."
            ],
            "type": "i64"
          },
          {
            "name": "lastActiveAt",
            "docs": [
              "Last time the owner proved liveness (\"pinged\"): set on init and refreshed",
              "on every `update_will`. The dead-man's switch measures silence from here."
            ],
            "type": "i64"
          },
          {
            "name": "inactivityThreshold",
            "docs": [
              "Seconds of owner silence required before custodians may confirm death.",
              "Must be > 0 (see `ErrorCode::InvalidThreshold`). `confirm_death` requires",
              "`now - last_active_at >= inactivity_threshold`."
            ],
            "type": "i64"
          },
          {
            "name": "claimableAt",
            "docs": [
              "Unix timestamp at which custodian quorum was reached and the will became",
              "`Claimable`. Zero while the will has never reached quorum (it is reset to",
              "zero by `revoke_death_confirmation`). This is the anchor for both",
              "post-death windows — see `grace_ends_at` / `claim_window_ends_at`."
            ],
            "type": "i64"
          },
          {
            "name": "mediaCount",
            "docs": [
              "Number of MediaReference children currently alive (rent held)."
            ],
            "type": "u8"
          },
          {
            "name": "mediaIndex",
            "docs": [
              "Monotonic counter used ONLY to derive collision-free media PDA seeds.",
              "Never decremented, so a removed slot's address is never reused. u16 gives",
              "a 65_535 lifetime ceiling on media uploads (vs. 255 for a u8)."
            ],
            "type": "u16"
          },
          {
            "name": "custodianCount",
            "docs": [
              "Number of Custodian children currently alive."
            ],
            "type": "u8"
          },
          {
            "name": "minApprovals",
            "docs": [
              "How many custodian confirmations are required to make the will Claimable.",
              "Invariant: `1 <= min_approvals`, and `min_approvals <= custodian_count`",
              "before any asset may be escrowed (see `ErrorCode::QuorumUnreachable`)."
            ],
            "type": "u8"
          },
          {
            "name": "approvalsReceived",
            "docs": [
              "Running tally of custodians who have confirmed death **in the current",
              "approval epoch**. Reset to zero by `revoke_death_confirmation`."
            ],
            "type": "u8"
          },
          {
            "name": "beneficiariesClaimed",
            "docs": [
              "Number of beneficiaries who have called `claim_inheritance`."
            ],
            "type": "u8"
          },
          {
            "name": "beneficiaryCount",
            "docs": [
              "Number of Beneficiary children currently alive."
            ],
            "type": "u32"
          },
          {
            "name": "tokenVaultCount",
            "docs": [
              "Number of TokenVault children currently alive. C2: `delete_will` and",
              "`close_will` both refuse to run while this is non-zero, so a will can",
              "never be closed out from under escrowed tokens (which would strand them",
              "permanently — the vault's authority is this very PDA)."
            ],
            "type": "u16"
          },
          {
            "name": "approvalEpoch",
            "docs": [
              "Monotonically increasing counter that invalidates every prior custodian",
              "confirmation in O(1). A custodian counts as having confirmed only when",
              "`custodian.has_approved && custodian.approved_epoch == will.approval_epoch`.",
              "`revoke_death_confirmation` bumps this, so a revoked confirmation round",
              "can never be replayed and no per-custodian account has to be touched.",
              "Starts at 1 so the default `approved_epoch` of 0 never matches."
            ],
            "type": "u16"
          },
          {
            "name": "totalAllocatedPercentage",
            "docs": [
              "Sum of all beneficiaries' allocations; never allowed to exceed 10_000."
            ],
            "type": "u16"
          },
          {
            "name": "bump",
            "docs": [
              "Cached PDA bump for this will."
            ],
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "willStatus",
      "docs": [
        "Lifecycle of a will.",
        "",
        "Happy path: `Active` --(some confirmations)--> `PendingInheritance`",
        "--(quorum)--> `Claimable` --(grace, then claims)--> closed.",
        "",
        "While `Active`, only the owner mutates the will (add/remove children, ping).",
        "Once quorum is reached the owner can no longer configure it, but until the",
        "grace period expires they may still `revoke_death_confirmation` and return",
        "the will to `Active`."
      ],
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "active"
          },
          {
            "name": "pendingInheritance"
          },
          {
            "name": "claimable"
          }
        ]
      }
    }
  ],
  "constants": [
    {
      "name": "beneficiarySeed",
      "docs": [
        "Seed for a beneficiary PDA: `[BENEFICIARY_SEED, will, beneficiary_wallet]`."
      ],
      "type": "bytes",
      "value": "[98, 101, 110, 101, 102, 105, 99, 105, 97, 114, 121]"
    },
    {
      "name": "claimWindowSeconds",
      "docs": [
        "Seconds heirs have to claim, starting when the grace period ends. Only after",
        "this expires may the permissionless teardown cranks run."
      ],
      "type": "i64",
      "value": "7776000"
    },
    {
      "name": "custodianSeed",
      "docs": [
        "Seed for a custodian PDA: `[CUSTODIAN_SEED, will, custodian_wallet]`."
      ],
      "type": "bytes",
      "value": "[99, 117, 115, 116, 111, 100, 105, 97, 110]"
    },
    {
      "name": "gracePeriodSeconds",
      "docs": [
        "Seconds the owner has to revoke a death confirmation after quorum is reached.",
        "Claims are frozen for this entire window."
      ],
      "type": "i64",
      "value": "604800"
    },
    {
      "name": "maxAllocationBps",
      "docs": [
        "Maximum total allocation across all beneficiaries, in basis points (100%)."
      ],
      "type": "u16",
      "value": "10000"
    },
    {
      "name": "mediaReferenceSeed",
      "docs": [
        "Seed for a media-reference PDA: `[MEDIA_REFERENCE_SEED, will, media_index_le]`."
      ],
      "type": "bytes",
      "value": "[109, 101, 100, 105, 97, 114, 101, 102, 101, 114, 101, 110, 99, 101]"
    },
    {
      "name": "tokenClaimSeed",
      "docs": [
        "Seed for a token-claim marker PDA: `[TOKEN_CLAIM_SEED, token_vault, beneficiary_wallet]`."
      ],
      "type": "bytes",
      "value": "[116, 111, 107, 101, 110, 99, 108, 97, 105, 109]"
    },
    {
      "name": "tokenVaultSeed",
      "type": "bytes",
      "value": "[116, 111, 107, 101, 110, 118, 97, 117, 108, 116]"
    },
    {
      "name": "willSeed",
      "docs": [
        "Seed for the per-owner will PDA: `[WILL_SEED, owner]`."
      ],
      "type": "bytes",
      "value": "[119, 105, 108, 108]"
    }
  ]
};
