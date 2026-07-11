/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/vault_inheritance.json`.
 */
export type VaultInheritance = {
  "address": "yBogztzGgSmrx27tMQfJQ9hvo13pu6QvYEVc1pcgqhF",
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
    "(IPFS CIDs), custodians (who can confirm death) and beneficiaries (heirs,",
    "with basis-point shares).",
    "3. **Ping** — `update_will` refreshes the liveness timer (and can re-tune the",
    "threshold / approvals). Each ping proves the owner is alive.",
    "4. **Confirm death** — once the owner has been silent past the threshold,",
    "custodians call `confirm_death`. When enough confirm, the will becomes",
    "`Claimable`.",
    "5. **Claim** — beneficiaries call `claim_inheritance` to accept; the frontend",
    "then grants them the stored IPFS CIDs.",
    "6. **Teardown** — permissionless `cleanup_*` + `close_will` cranks reclaim all",
    "rent to the estate (the owner wallet) once everything is settled.",
    "",
    "## SOL / rent model",
    "Every account is rent-funded by the **owner** at `init`. Every removal path",
    "(`remove_*`, `delete_will`, and the post-death `cleanup_*` / `close_will`)",
    "closes the account and refunds its rent to the owner — so no SOL is ever",
    "permanently stranded. The program holds no asset vault; this MVP gates access",
    "to off-chain media, it does not transfer SOL/SPL to beneficiaries."
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
    }
  ],
  "types": [
    {
      "name": "beneficiary",
      "docs": [
        "A beneficiary inherits a share of the estate. `allocation_percentage` is the",
        "intended share in basis points; `has_claimed` records acceptance."
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
              "Whether this custodian has confirmed death. Prevents double-counting."
            ],
            "type": "bool"
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
        "IPFS content identifier. The bytes live on IPFS; only the pointer is on-chain."
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
              "`Qm...`) and CIDv1 (59-char base32, `bafy...`) which the 46-byte buffer",
              "could not hold (M3 fix)."
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
      "name": "tokenVault",
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
        "(custodians, beneficiaries, media references) are children whose PDAs are",
        "seeded by this will's key.",
        "",
        "SCOPE NOTE (M1): this MVP is an *access-control* vault, not an asset-custody",
        "vault. The will does not escrow SOL or SPL tokens. `allocation_percentage`",
        "on each beneficiary records the intended share of the off-chain estate, and",
        "`claim_inheritance` records *that* a beneficiary accepted — the frontend then",
        "grants them the IPFS CIDs stored in the MediaReference children. If on-chain",
        "asset distribution is added later, it would live in `claim_inheritance` and",
        "pull from a vault PDA funded by the owner."
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
              "Invariant: `1 <= min_approvals <= custodian_count` whenever custodians",
              "exist (see custodian.rs / will.rs validation)."
            ],
            "type": "u8"
          },
          {
            "name": "approvalsReceived",
            "docs": [
              "Running tally of distinct custodians who have confirmed death."
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
        "--(enough confirmations)--> `Claimable` --(estate settled)--> closed.",
        "",
        "While `Active`, only the owner mutates the will (add/remove children, ping).",
        "Once death is confirmed the owner can no longer change it; custodians/",
        "beneficiaries drive it forward."
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
      "name": "custodianSeed",
      "docs": [
        "Seed for a custodian PDA: `[CUSTODIAN_SEED, will, custodian_wallet]`."
      ],
      "type": "bytes",
      "value": "[99, 117, 115, 116, 111, 100, 105, 97, 110]"
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
