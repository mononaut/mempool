import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FaIconLibrary, FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faFilter, faAngleDown, faAngleUp, faAngleRight, faAngleLeft, faBolt, faChartArea, faCogs, faCubes, faHammer, faDatabase, faExchangeAlt, faInfoCircle,
  faLink, faList, faSearch, faCaretUp, faCaretDown, faTachometerAlt, faThList, faTint, faTv, faAngleDoubleDown, faSortUp, faAngleDoubleUp, faChevronDown, faFileAlt, faRedoAlt, faArrowAltCircleRight, faExternalLinkAlt, faBook, faListUl, faQrcode, faDownload } from '@fortawesome/free-solid-svg-icons';
import { VbytesPipe } from './pipes/bytes-pipe/vbytes.pipe';
import { ShortenStringPipe } from './pipes/shorten-string-pipe/shorten-string.pipe';
import { CeilPipe } from './pipes/math-ceil/math-ceil.pipe';
import { Hex2asciiPipe } from './pipes/hex2ascii/hex2ascii.pipe';
import { Decimal2HexPipe } from './pipes/decimal2hex/decimal2hex.pipe';
import { FeeRoundingPipe } from './pipes/fee-rounding/fee-rounding.pipe';
import { AsmStylerPipe } from './pipes/asm-styler/asm-styler.pipe';
import { AbsolutePipe } from './pipes/absolute/absolute.pipe';
import { RelativeUrlPipe } from './pipes/relative-url/relative-url.pipe';
import { ScriptpubkeyTypePipe } from './pipes/scriptpubkey-type-pipe/scriptpubkey-type.pipe';
import { BytesPipe } from './pipes/bytes-pipe/bytes.pipe';
import { WuBytesPipe } from './pipes/bytes-pipe/wubytes.pipe';
import { BlockchainComponent } from '../components/blockchain/blockchain.component';
import { TimeSinceComponent } from '../components/time-since/time-since.component';
import { TimeUntilComponent } from '../components/time-until/time-until.component';
import { ClipboardComponent } from '../components/clipboard/clipboard.component';
import { QrcodeComponent } from '../components/qrcode/qrcode.component';
import { FiatComponent } from '../fiat/fiat.component';
import { NgbNavModule, NgbTooltipModule, NgbButtonsModule, NgbPaginationModule, NgbDropdownModule, NgbAccordionModule } from '@ng-bootstrap/ng-bootstrap';
import { TxFeaturesComponent } from '../components/tx-features/tx-features.component';
import { TxFeeRatingComponent } from '../components/tx-fee-rating/tx-fee-rating.component';
import { ReactiveFormsModule } from '@angular/forms';
import { LanguageSelectorComponent } from '../components/language-selector/language-selector.component';
import { ColoredPriceDirective } from './directives/colored-price.directive';
import { NoSanitizePipe } from './pipes/no-sanitize.pipe';
import { MempoolBlocksComponent } from '../components/mempool-blocks/mempool-blocks.component';
import { BlockchainBlocksComponent } from '../components/blockchain-blocks/blockchain-blocks.component';
import { AmountComponent } from '../components/amount/amount.component';
import { RouterModule } from '@angular/router';
import { ChangeComponent } from '../components/change/change.component';
import { AmountShortenerPipe } from '../shared/pipes/amount-shortener.pipe';
import { SatsComponent } from './components/sats/sats.component';

@NgModule({
  declarations: [
    ClipboardComponent,
    TimeSinceComponent,
    TimeUntilComponent,
    QrcodeComponent,
    FiatComponent,
    TxFeaturesComponent,
    TxFeeRatingComponent,
    LanguageSelectorComponent,
    ScriptpubkeyTypePipe,
    RelativeUrlPipe,
    NoSanitizePipe,
    Hex2asciiPipe,
    AsmStylerPipe,
    AbsolutePipe,
    BytesPipe,
    VbytesPipe,
    WuBytesPipe,
    CeilPipe,
    ShortenStringPipe,
    Decimal2HexPipe,
    FeeRoundingPipe,
    ColoredPriceDirective,
    BlockchainComponent,
    MempoolBlocksComponent,
    BlockchainBlocksComponent,
    AmountComponent,
    ChangeComponent,
    AmountShortenerPipe,
    SatsComponent,
  ],
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    NgbNavModule,
    NgbTooltipModule,
    NgbButtonsModule,
    NgbPaginationModule,
    NgbDropdownModule,
    NgbAccordionModule,
    FontAwesomeModule,
  ],
  providers: [
    VbytesPipe,
    RelativeUrlPipe,
    NoSanitizePipe,
    AmountShortenerPipe,
  ],
  exports: [
    RouterModule,
    NgbAccordionModule,
    NgbNavModule,
    CommonModule,
    ReactiveFormsModule,
    NgbTooltipModule,
    NgbButtonsModule,
    NgbPaginationModule,
    NgbDropdownModule,
    TimeSinceComponent,
    TimeUntilComponent,
    ClipboardComponent,
    QrcodeComponent,
    FiatComponent,
    TxFeaturesComponent,
    TxFeeRatingComponent,
    LanguageSelectorComponent,
    ScriptpubkeyTypePipe,
    RelativeUrlPipe,
    Hex2asciiPipe,
    AsmStylerPipe,
    AbsolutePipe,
    BytesPipe,
    VbytesPipe,
    WuBytesPipe,
    CeilPipe,
    ShortenStringPipe,
    Decimal2HexPipe,
    FeeRoundingPipe,
    ColoredPriceDirective,
    NoSanitizePipe,
    BlockchainComponent,
    MempoolBlocksComponent,
    BlockchainBlocksComponent,
    AmountComponent,
    ChangeComponent,
    AmountShortenerPipe,
    SatsComponent,
    FontAwesomeModule,
  ]
})
export class SharedModule {
  constructor(library: FaIconLibrary) {
    library.addIcons(faInfoCircle);
    library.addIcons(faChartArea);
    library.addIcons(faTv);
    library.addIcons(faTachometerAlt);
    library.addIcons(faCubes);
    library.addIcons(faHammer);
    library.addIcons(faCogs);
    library.addIcons(faThList);
    library.addIcons(faList);
    library.addIcons(faTachometerAlt);
    library.addIcons(faDatabase);
    library.addIcons(faSearch);
    library.addIcons(faLink);
    library.addIcons(faBolt);
    library.addIcons(faTint);
    library.addIcons(faFilter);
    library.addIcons(faAngleDown);
    library.addIcons(faAngleUp);
    library.addIcons(faExchangeAlt);
    library.addIcons(faAngleDoubleUp);
    library.addIcons(faAngleDoubleDown);
    library.addIcons(faChevronDown);
    library.addIcons(faFileAlt);
    library.addIcons(faRedoAlt);
    library.addIcons(faArrowAltCircleRight);
    library.addIcons(faExternalLinkAlt);
    library.addIcons(faSortUp);
    library.addIcons(faCaretUp);
    library.addIcons(faCaretDown);
    library.addIcons(faAngleRight);
    library.addIcons(faAngleLeft);
    library.addIcons(faBook);
    library.addIcons(faListUl);
    library.addIcons(faDownload);
    library.addIcons(faQrcode);
  }
}
