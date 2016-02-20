module Test.Main where

import Prelude (Unit)
import Test.StrongCheck (QC)


main :: QC Unit
main = Test.Yahtzee.tests

